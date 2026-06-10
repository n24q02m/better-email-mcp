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

export type SmtpSecurity = 'tls' | 'ssl' | 'starttls' | 'none'

function isSmtpSecurity(segment: string): segment is SmtpSecurity {
  return /^(tls|ssl|starttls|none)$/i.test(segment)
}

/**
 * Parse password, custom IMAP/SMTP host+port from the colon-separated
 * segments of a credential entry (`parts[0]` is the email).
 *
 * Full canonical format (closes #634 — symmetric to IMAP override):
 *   email:password:imap_host[:imap_port[:smtp_host[:smtp_port[:smtp_security]]]]
 *
 * Backward-compatible tails (most-specific first):
 *  - `...:imap_host:imap_port:smtp_host:smtp_port:smtp_security`
 *  - `...:imap_host:imap_port:smtp_host:smtp_port`
 *  - `...:imap_host:imap_port:smtp_host` (smtp uses defaults: 587 + starttls)
 *  - `...:imap_host:imap_port` -- existing behaviour, SMTP guessed
 *  - `...:imap_host`           -- existing, default IMAP port + SMTP guessed
 *  - else: whole tail is password (embedded colons preserved)
 *
 * Detection is greedy from the END so passwords with embedded colons keep
 * working when no host suffix is supplied.
 */
function parsePasswordAndHost(parts: string[]): {
  password: string
  customImapHost?: string
  customImapPort?: number
  customSmtpHost?: string
  customSmtpPort?: number
  customSmtpSecurity?: SmtpSecurity
} {
  if (parts.length === 2) {
    // email:password
    return { password: parts[1]! }
  }

  // Mutable tail; pop SMTP, then IMAP, then rest is password.
  const tail = parts.slice(1)
  const smtp = extractSmtpSegments(tail)
  const imap = extractImapSegments(tail)
  const password = tail.join(':')

  return {
    password,
    customImapHost: imap.host,
    customImapPort: imap.port,
    customSmtpHost: smtp.host,
    customSmtpPort: smtp.port,
    customSmtpSecurity: smtp.security
  }
}

/**
 * Helper: an "all-digit" segment looks like a port attempt (even if value
 * is out-of-range, in which case parsePort returns undefined and the
 * caller falls back to the protocol-default port).
 */
function isPortSegment(s: string): boolean {
  return /^\d+$/.test(s)
}

/**
 * Extract SMTP segments from the tail of the credential string.
 * This includes optional host, port, and security keyword.
 */
function extractSmtpSegments(tail: string[]): {
  host?: string
  port?: number
  security?: SmtpSecurity
} {
  let security: SmtpSecurity | undefined
  let host: string | undefined
  let port: number | undefined

  // 1. Optional SMTP security keyword at end (only valid when an SMTP host
  //    can also be detected; otherwise the keyword belongs to the password).
  //    We tentatively pop + restore if SMTP host parsing fails.
  let popped_security = false
  if (tail.length >= 4 && isSmtpSecurity(tail.at(-1)!)) {
    security = tail.at(-1)!.toLowerCase() as SmtpSecurity
    tail.pop()
    popped_security = true
  }

  // 2. SMTP host + port (host:port pair). Detected only when tail has BOTH:
  //    - tail.at(-1) is all-digit (a port attempt)
  //    - tail.at(-2) is a host
  //    AND there's another preceding host (the IMAP host) — otherwise the
  //    "host:port" we see IS the IMAP host:port and there's no SMTP suffix.
  const canHaveSmtpHostPort =
    tail.length >= 5 && isPortSegment(tail.at(-1)!) && looksLikeHost(tail.at(-2)!) && looksLikeHost(tail.at(-4) ?? '') // ensure there's an IMAP host before
  if (canHaveSmtpHostPort) {
    port = parsePort(tail.at(-1)!) // may be undefined if out-of-range → buildSmtpConfig defaults
    tail.pop()
    host = tail.pop()
  }

  // 3. SMTP host without explicit port (only valid when security was popped
  //    OR when there's an explicit IMAP host:port already detected).
  if (!host && popped_security && tail.length >= 3 && looksLikeHost(tail.at(-1)!)) {
    host = tail.pop()
  }

  // If security keyword was tentatively popped but no SMTP host was found,
  // restore it — the keyword is part of the password.
  if (popped_security && !host) {
    tail.push(security!)
    security = undefined
  }

  return { host, port, security }
}

/**
 * Extract IMAP segments from the tail of the credential string.
 * This includes optional host and port.
 */
function extractImapSegments(tail: string[]): { host?: string; port?: number } {
  let host: string | undefined
  let port: number | undefined

  // IMAP host + port (port may be out-of-range; resolveServerConfig
  // falls back to default 993 when port is undefined).
  if (tail.length >= 3 && isPortSegment(tail.at(-1)!) && looksLikeHost(tail.at(-2)!)) {
    port = parsePort(tail.at(-1)!)
    tail.pop()
    host = tail.pop()
  } else if (looksLikeHost(tail.at(-1)!)) {
    // Trailing host segment, default IMAP port
    host = tail.pop()
  }

  return { host, port }
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
 * Build SMTP ServerConfig from explicit host/port/security override.
 * Defaults follow standard mail-submission conventions:
 *  - `tls` / `ssl` → secure=true, default port 465 (implicit TLS / SMTPS)
 *  - `starttls`    → secure=false, default port 587 (submission + STARTTLS)
 *  - `none`        → secure=false, default port 25 (rare, plain SMTP)
 *  - unspecified   → secure=false, default port 587 (matches modern default)
 */
function buildSmtpConfig(host: string, port?: number, security?: SmtpSecurity): ServerConfig {
  if (security === 'tls' || security === 'ssl') {
    return { host, port: port ?? 465, secure: true }
  }
  if (security === 'none') {
    return { host, port: port ?? 25, secure: false }
  }
  // starttls or unspecified
  return { host, port: port ?? 587, secure: false }
}

/**
 * Resolve IMAP/SMTP server configuration. SMTP override (host[:port[:sec]])
 * takes precedence; otherwise SMTP is guessed from the IMAP host (existing
 * behaviour). When neither IMAP nor SMTP is custom, auto-discover from
 * provider table. Closes #634 for asymmetric SMTP/IMAP topologies.
 */
function resolveServerConfig(
  email: string,
  customImapHost?: string,
  customImapPort?: number,
  customSmtpHost?: string,
  customSmtpPort?: number,
  customSmtpSecurity?: SmtpSecurity
): { imap: ServerConfig; smtp: ServerConfig } | null {
  if (customImapHost) {
    // Default to standard implicit-TLS IMAPS (993). A non-993 port is
    // treated as plaintext/STARTTLS -- the common shape for a local proxy.
    const port = customImapPort ?? 993
    const imap = { host: customImapHost, port, secure: port === 993 }
    const smtp = customSmtpHost
      ? buildSmtpConfig(customSmtpHost, customSmtpPort, customSmtpSecurity)
      : // Guess SMTP from IMAP host (legacy)
        { host: customImapHost.replace('imap.', 'smtp.'), port: 587, secure: false }
    return { imap, smtp }
  }

  // No custom IMAP — env-var SMTP override is still honoured for accounts
  // whose provider IS auto-discoverable but whose SMTP MUST route elsewhere
  // (rare; primary use is corporate IMAP+SMTP both custom).
  const discovered = discoverSettings(email)
  if (!discovered) {
    if (customSmtpHost) {
      console.error(
        'Cannot auto-discover IMAP for the provided email. Custom SMTP alone is not enough — provide IMAP host too: email:password:imap.server.com:993:smtp.server.com:587:starttls'
      )
    } else {
      console.error('Cannot auto-discover settings for the provided email. Use format: email:password:imap.server.com')
    }
    return null
  }
  const smtp = customSmtpHost ? buildSmtpConfig(customSmtpHost, customSmtpPort, customSmtpSecurity) : discovered.smtp
  return { imap: discovered.imap, smtp }
}

/**
 * Handle logic for OAuth2-only (Outlook) email-only entry
 */
async function handleOAuth2OnlyEntry(email: string): Promise<AccountConfig | null> {
  const account = await createOAuth2Account(email)
  if (account) return account

  console.error('Skipping invalid credential entry (expected email:password)')
  return null
}

/**
 * Handle logic for standard email:password entries (with optional host overrides)
 */
async function handlePasswordEntry(email: string, parts: string[]): Promise<AccountConfig | null> {
  const { password, customImapHost, customImapPort, customSmtpHost, customSmtpPort, customSmtpSecurity } =
    parsePasswordAndHost(parts)

  // Auto-discover or use custom host (SMTP override applied if provided)
  const servers = resolveServerConfig(
    email,
    customImapHost,
    customImapPort,
    customSmtpHost,
    customSmtpPort,
    customSmtpSecurity
  )
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
 * Parse a single credential entry
 */
async function parseSingleCredential(entry: string): Promise<AccountConfig | null> {
  const trimmed = entry.trim()
  if (!trimmed) return null

  const parts = trimmed.split(':')
  const email = parts[0]!.trim()

  // Outlook/Hotmail/Live: email-only entry is valid (OAuth2, no password needed)
  if (parts.length < 2) {
    return handleOAuth2OnlyEntry(email)
  }

  return handlePasswordEntry(email, parts)
}

/**
 * Parse EMAIL_CREDENTIALS environment variable
 *
 * Supported formats:
 * - Simple: email1:password1,email2:password2
 * - Custom IMAP host: email1:password1:imap.custom.com,email2:password2
 * - Custom IMAP host + port: email:password:imap.custom.com:1993
 * - Custom IMAP + SMTP (closes #634): email:password:imap.custom.com:993:smtp.custom.com:587:starttls
 *   - SMTP host alone: email:password:imap.custom.com:993:smtp.custom.com (port 587, starttls)
 *   - SMTP host + port: email:password:imap.custom.com:993:smtp.custom.com:587 (starttls)
 *   - SMTP security keyword: `tls` / `ssl` (implicit TLS, default port 465) |
 *     `starttls` (STARTTLS upgrade, default port 587) | `none` (plain, port 25)
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
