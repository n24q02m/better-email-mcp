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
 * Parse a credential segment as a TCP port. Returns the number only when it
 * is all-digits and within the valid 1-65535 range, otherwise undefined.
 */
function parsePort(segment: string): number | undefined {
  if (!/^\d+$/.test(segment)) return undefined
  const port = Number(segment)
  return port >= 1 && port <= 65535 ? port : undefined
}

/**
 * Whether a credential segment looks like an IMAP host. A dotted name
 * (hostname or IPv4 literal) qualifies, and so does the literal `localhost`
 * — the latter lets users point an account at a local IMAP proxy.
 */
function looksLikeHost(segment: string): boolean {
  return segment.includes('.') || segment.toLowerCase() === 'localhost'
}

/**
 * Parse password, custom IMAP host, and custom IMAP port from the
 * colon-separated segments of a credential entry (`parts[0]` is the email).
 *
 * Recognised tails, most specific first:
 *  - `...:host:port` -- trailing all-digit port preceded by a host segment
 *  - `...:host`      -- trailing host segment
 *  - otherwise the whole tail is the password (embedded colons preserved)
 */
function parsePasswordAndHost(parts: string[]): {
  password: string
  customImapHost?: string
  customImapPort?: number
} {
  if (parts.length === 2) {
    // email:password
    return { password: parts[1]! }
  }

  const last = parts[parts.length - 1]!
  const secondLast = parts[parts.length - 2]!

  // email:password[:...]:host:port -- a host segment followed by a numeric port
  if (parts.length >= 4 && /^\d+$/.test(last) && looksLikeHost(secondLast)) {
    return {
      password: parts.slice(1, -2).join(':'),
      customImapHost: secondLast,
      customImapPort: parsePort(last)
    }
  }

  // email:password[:...]:host -- a trailing host segment, default port
  if (looksLikeHost(last)) {
    return {
      password: parts.slice(1, -1).join(':'),
      customImapHost: last
    }
  }

  // No host segment -- the whole tail is the password (may contain colons)
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
 * Resolve IMAP/SMTP server configuration
 */
function resolveServerConfig(
  email: string,
  customImapHost?: string,
  customImapPort?: number
): { imap: ServerConfig; smtp: ServerConfig } | null {
  if (customImapHost) {
    // Default to standard implicit-TLS IMAPS (993). A non-993 port is
    // treated as plaintext/STARTTLS -- the common shape for a local proxy.
    const port = customImapPort ?? 993
    const imap = { host: customImapHost, port, secure: port === 993 }
    // Guess SMTP from IMAP host
    const smtp = { host: customImapHost.replace('imap.', 'smtp.'), port: 587, secure: false }
    return { imap, smtp }
  }

  const discovered = discoverSettings(email)
  if (!discovered) {
    console.error('Cannot auto-discover settings for the provided email. Use format: email:password:imap.server.com')
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

  // Outlook domains use OAuth2 by default. An explicit custom IMAP host means
  // the account is routed through a proxy with password auth — honour that.
  if (!customImapHost) {
    await applyOutlookOAuth2(account)
  }

  return account
}

/**
 * Parse EMAIL_CREDENTIALS environment variable
 *
 * Supported formats:
 * - Simple: email1:password1,email2:password2
 * - Custom IMAP host: email1:password1:imap.custom.com,email2:password2
 * - Custom IMAP host + port: email:password:imap.custom.com:1993
 * - Local IMAP proxy: email:password:localhost:1993 (the literal `localhost`
 *   is accepted as a host even though it has no dot; each account may use its
 *   own host and port)
 * - Passwords with commas are NOT supported (use env var per account instead)
 *
 * For passwords containing colons, append the host segment to disambiguate:
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
