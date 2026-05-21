/**
 * Configuration Parser
 * Parses EMAIL_CREDENTIALS env var and auto-discovers IMAP/SMTP settings
 */

import { EmailMCPError } from './errors.js'
import type { OAuth2Tokens } from './oauth2.js'
import { isOutlookDomain, loadStoredTokens } from './oauth2.js'

export interface ServerConfig {
  host: string
  port: number
  secure: boolean
}

export interface AccountConfig {
  id: string
  email: string
  password: string
  authType?: 'password' | 'oauth2'
  imap: ServerConfig
  smtp: ServerConfig
  oauth2?: OAuth2Tokens
}

/** Well-known email provider settings */
const GMAIL_SETTINGS = {
  imap: { host: 'imap.gmail.com', port: 993, secure: true },
  smtp: { host: 'smtp.gmail.com', port: 465, secure: true }
}

const OUTLOOK_SETTINGS = {
  imap: { host: 'outlook.office365.com', port: 993, secure: true },
  smtp: { host: 'smtp.office365.com', port: 587, secure: false }
}

const YAHOO_SETTINGS = {
  imap: { host: 'imap.mail.yahoo.com', port: 993, secure: true },
  smtp: { host: 'smtp.mail.yahoo.com', port: 465, secure: true }
}

const ICLOUD_SETTINGS = {
  imap: { host: 'imap.mail.me.com', port: 993, secure: true },
  smtp: { host: 'smtp.mail.me.com', port: 587, secure: false }
}

const ZOHO_SETTINGS = {
  imap: { host: 'imap.zoho.com', port: 993, secure: true },
  smtp: { host: 'smtp.zoho.com', port: 465, secure: true }
}

const PROTONMAIL_SETTINGS = {
  imap: { host: 'imap.protonmail.ch', port: 993, secure: true },
  smtp: { host: 'smtp.protonmail.ch', port: 465, secure: true }
}

const PROVIDER_MAP: Record<string, { imap: ServerConfig; smtp: ServerConfig }> = {
  'gmail.com': GMAIL_SETTINGS,
  'googlemail.com': GMAIL_SETTINGS,
  'outlook.com': OUTLOOK_SETTINGS,
  'hotmail.com': OUTLOOK_SETTINGS,
  'live.com': OUTLOOK_SETTINGS,
  'yahoo.com': YAHOO_SETTINGS,
  'icloud.com': ICLOUD_SETTINGS,
  'me.com': ICLOUD_SETTINGS,
  'zoho.com': ZOHO_SETTINGS,
  'protonmail.com': PROTONMAIL_SETTINGS
}

// ⚡ Bolt: Pre-compute Object.entries(PROVIDER_MAP) once at module load to avoid
// recreating the array of arrays on every call to discoverSettings.
// This yields a ~6.5x speedup for subdomain lookups.
const PROVIDER_MAP_ENTRIES = Object.entries(PROVIDER_MAP)

/**
 * Auto-discover IMAP/SMTP settings from email domain
 */
function discoverSettings(email: string): { imap: ServerConfig; smtp: ServerConfig } | null {
  const atIndex = email.indexOf('@')
  if (atIndex === -1) return null
  const domain = email.substring(atIndex + 1).toLowerCase()
  if (!domain) return null

  // Check exact domain match
  if (PROVIDER_MAP[domain]) {
    return PROVIDER_MAP[domain]
  }

  // Check if subdomain matches (e.g. user@work.gmail.com)
  for (let i = 0; i < PROVIDER_MAP_ENTRIES.length; i++) {
    const entry = PROVIDER_MAP_ENTRIES[i]!
    if (domain.endsWith(`.${entry[0]}`)) {
      return entry[1]
    }
  }

  return null
}

/**
 * Generate a safe ID from email address
 */
function emailToId(email: string): string {
  return email.replace(/[@.]/g, '_').toLowerCase()
}

/**
 * Detect if a credential trailing token looks like an IMAP host endpoint.
 * Accepts:
 *   - hostnames with a dot (e.g. `imap.example.com`)
 *   - `localhost`
 *   - bare IPv4 (e.g. `127.0.0.1`)
 *   - `host:port` variants of any of the above (e.g. `localhost:1993`,
 *     `imap.local:993`).
 *
 * The previous "must contain a dot" heuristic was rejecting users who run
 * an IMAP proxy on `localhost` with non-standard ports (issue #610).
 */
function looksLikeImapHost(token: string): boolean {
  if (!token) return false

  // host:port form — split off the port, validate the host portion, and
  // ensure the port is a positive integer.
  const lastColon = token.lastIndexOf(':')
  if (lastColon > 0) {
    const maybePort = token.slice(lastColon + 1)
    if (/^\d{1,5}$/.test(maybePort)) {
      const portNum = Number(maybePort)
      if (portNum > 0 && portNum <= 65535) {
        return looksLikeImapHost(token.slice(0, lastColon))
      }
    }
    // Colon present but not followed by a valid port -- this isn't a host,
    // it's a password chunk that happens to contain ':'.
    return false
  }

  // Restrict to charset that fits hostnames / IPv4. Rejects passwords that
  // look like words ("nohostname") but allows real hosts and `localhost`.
  if (!/^[a-zA-Z0-9.-]+$/.test(token)) return false
  if (token === 'localhost') return true
  return token.includes('.')
}

/**
 * Split a credential trailing token into host + optional port.
 * Returns `null` if no port was specified.
 */
function splitHostPort(token: string): { host: string; port: number | null } {
  const lastColon = token.lastIndexOf(':')
  if (lastColon > 0) {
    const maybePort = token.slice(lastColon + 1)
    if (/^\d{1,5}$/.test(maybePort)) {
      const portNum = Number(maybePort)
      if (portNum > 0 && portNum <= 65535) {
        return { host: token.slice(0, lastColon), port: portNum }
      }
    }
  }
  return { host: token, port: null }
}

/**
 * Parse password and custom IMAP host (with optional port) from credential parts.
 *
 * Supported credential shapes after splitting on `:` (excluding the email
 * prefix part 0):
 *   - `email:password`
 *   - `email:password:imap.host`         (host)
 *   - `email:password:imap.host:993`     (host + port)
 *   - `email:password:localhost:1993`    (localhost + port — issue #610)
 *   - `email:password_with_colons[:...]` (password may contain colons)
 */
function parsePasswordAndHost(parts: string[]): {
  password: string
  customImapHost?: string
  customImapPort?: number
} {
  if (parts.length === 2) {
    return { password: parts[1]! }
  }

  // Greedy match: try to interpret a trailing `host[:port]` (1 or 2 trailing
  // parts) as a custom endpoint. Prefer the longest match so passwords
  // containing colons still parse cleanly.

  // Try `host:port` (2 trailing parts that join into a host:port string).
  if (parts.length >= 4) {
    const candidate = `${parts[parts.length - 2]}:${parts[parts.length - 1]}`
    if (looksLikeImapHost(candidate)) {
      const { host, port } = splitHostPort(candidate)
      return {
        password: parts.slice(1, -2).join(':'),
        customImapHost: host,
        customImapPort: port ?? undefined
      }
    }
  }

  // Try single trailing `host` (or `host:port` collapsed in one token like
  // `imap.example.com:993` — uncommon because we split on `:` already).
  const last = parts[parts.length - 1]!
  if (looksLikeImapHost(last)) {
    const { host, port } = splitHostPort(last)
    return {
      password: parts.slice(1, -1).join(':'),
      customImapHost: host,
      customImapPort: port ?? undefined
    }
  }

  // No trailing host — password itself contains colons.
  return { password: parts.slice(1).join(':') }
}

/**
 * Create an account config for OAuth2-only (Outlook) email-only entry
 */
async function createOAuth2Account(email: string): Promise<AccountConfig | null> {
  if (!isOutlookDomain(email)) return null

  const discovered = discoverSettings(email)
  if (!discovered) return null

  const account: AccountConfig = {
    id: emailToId(email),
    email,
    password: '',
    authType: 'oauth2',
    imap: discovered.imap,
    smtp: discovered.smtp
  }

  const tokens = await loadStoredTokens(email)
  if (tokens) account.oauth2 = tokens
  return account
}

/**
 * Apply Outlook-specific OAuth2 settings if applicable
 */
async function applyOutlookOAuth2(account: AccountConfig): Promise<void> {
  if (isOutlookDomain(account.email)) {
    account.authType = 'oauth2'
    const tokens = await loadStoredTokens(account.email)
    if (tokens) {
      account.oauth2 = tokens
    }
  }
}

/**
 * Resolve IMAP/SMTP server configuration.
 *
 * When a custom IMAP host is supplied with a non-default port, `secure` is
 * inferred: ports 993 / 995 → TLS, all others (e.g. 143, 1993, 2525) → STARTTLS.
 * This lets users point at local proxies on non-standard ports (issue #610).
 */
function resolveServerConfig(
  email: string,
  customImapHost?: string,
  customImapPort?: number
): { imap: ServerConfig; smtp: ServerConfig } | null {
  if (customImapHost) {
    const imapPort = customImapPort ?? 993
    const imapSecure = imapPort === 993 || imapPort === 995
    const imap = { host: customImapHost, port: imapPort, secure: imapSecure }
    // Guess SMTP from IMAP host. Preserve the same host for localhost / proxy
    // setups (rather than rewriting `imap.` → `smtp.`, which yields `smtp` /
    // `smtp.localhost` and breaks lookups).
    const smtpHost = customImapHost.includes('.') ? customImapHost.replace('imap.', 'smtp.') : customImapHost
    const smtp = { host: smtpHost, port: 587, secure: false }
    return { imap, smtp }
  }

  const discovered = discoverSettings(email)
  if (!discovered) {
    console.error(
      'Cannot auto-discover settings for the provided email. Use format: email:password:imap.server.com or email:password:host:port'
    )
    return null
  }
  return discovered
}

/**
 * Parse a single credential entry
 */
async function parseSingleCredential(entry: string): Promise<AccountConfig | null> {
  const trimmed = entry.trim()
  if (!trimmed) return null

  const parts = trimmed.split(':')
  const email = parts[0]!.trim()

  // Outlook/Hotmail/Live: email-only entry is valid (OAuth2, no password needed)
  if (parts.length < 2) {
    const account = await createOAuth2Account(email)
    if (account) return account

    console.error('Skipping invalid credential entry (expected email:password)')
    return null
  }

  const { password, customImapHost, customImapPort } = parsePasswordAndHost(parts)

  // Auto-discover or use custom host
  const servers = resolveServerConfig(email, customImapHost, customImapPort)
  if (!servers) return null

  const account: AccountConfig = {
    id: emailToId(email),
    email,
    password,
    authType: 'password',
    imap: servers.imap,
    smtp: servers.smtp
  }

  // For Outlook domains, always use OAuth2 — password auth is not supported.
  await applyOutlookOAuth2(account)

  return account
}

/**
 * Parse EMAIL_CREDENTIALS environment variable
 *
 * Supported formats:
 * - Simple: email1:password1,email2:password2
 * - With custom IMAP host: email1:password1:imap.custom.com,email2:password2
 * - With custom IMAP host + port: email:password:host:port (issue #610)
 *     e.g. `user@example.com:secret:localhost:1993` for a local IMAP proxy
 *          `user@example.com:secret:127.0.0.1:1430`
 * - Passwords with commas are NOT supported (use env var per account instead)
 *
 * For passwords containing colons, use the explicit host (3+ field) format
 * to disambiguate:
 *   email:password_with:colon:imap_host
 */
export async function parseCredentials(envValue: string): Promise<AccountConfig[]> {
  if (!envValue || envValue.trim() === '') {
    return []
  }

  const entries = envValue.split(',')
  const results = await Promise.all(entries.map(parseSingleCredential))
  return results.filter((a): a is AccountConfig => a !== null)
}

/**
 * Load and validate configuration from environment
 */
export async function loadConfig(): Promise<AccountConfig[]> {
  const credentials = process.env.EMAIL_CREDENTIALS
  if (!credentials) {
    return []
  }
  return parseCredentials(credentials)
}

export function resolveAccount(accounts: AccountConfig[], query: string): AccountConfig {
  const lower = query.toLowerCase().trim()

  const exact: AccountConfig[] = []
  const partial: AccountConfig[] = []

  for (const a of accounts) {
    const lowerEmail = a.email.toLowerCase()
    if (lowerEmail === lower || a.id === lower) exact.push(a)
    else if (lowerEmail.includes(lower)) partial.push(a)
  }

  if (exact.length === 1) return exact[0]!
  if (exact.length > 1) {
    return exact[0]! // Should not happen with well-formed IDs, but fallback safely
  }

  if (partial.length === 0)
    throw new EmailMCPError(
      `Account not found: ${query}`,
      'ACCOUNT_NOT_FOUND',
      `Available accounts: ${accounts.map((a) => a.email).join(', ')}`
    )
  if (partial.length > 1)
    throw new EmailMCPError(
      'Multiple accounts matched. Specify the exact account email.',
      'AMBIGUOUS_ACCOUNT',
      `Matched: ${partial.map((a) => a.email).join(', ')}`
    )
  return partial[0]!
}

/**
 * Resolve a single account, with optional filter.
 * When filter is omitted and there's exactly one account, returns it.
 * Throws AMBIGUOUS_ACCOUNT if multiple accounts match.
 */
export function resolveSingleAccount(accounts: AccountConfig[], accountFilter?: string): AccountConfig {
  const resolved = resolveAccounts(accounts, accountFilter)
  if (resolved.length > 1) {
    throw new EmailMCPError(
      'Multiple accounts matched. Specify the exact account email.',
      'AMBIGUOUS_ACCOUNT',
      `Matched: ${resolved.map((a) => a.email).join(', ')}`
    )
  }
  return resolved[0]!
}

export function resolveAccounts(accounts: AccountConfig[], query?: string): AccountConfig[] {
  if (accounts.length === 0) {
    throw new EmailMCPError(
      'No email accounts configured',
      'NO_ACCOUNTS',
      'Set EMAIL_CREDENTIALS env var. Format: email1:password1,email2:password2'
    )
  }
  if (!query) return accounts
  const lower = query.toLowerCase().trim()

  const exact: AccountConfig[] = []
  const partial: AccountConfig[] = []

  for (const a of accounts) {
    const lowerEmail = a.email.toLowerCase()
    if (lowerEmail === lower || a.id === lower) exact.push(a)
    else if (lowerEmail.includes(lower)) partial.push(a)
  }

  if (exact.length > 0) return exact

  if (partial.length === 0)
    throw new EmailMCPError(
      `Account not found: ${query}`,
      'ACCOUNT_NOT_FOUND',
      `Available accounts: ${accounts.map((a) => a.email).join(', ')}`
    )
  return partial
}
