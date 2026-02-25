/**
 * Configuration Parser
 * Parses EMAIL_CREDENTIALS env var and auto-discovers IMAP/SMTP settings
 */

/** Well-known email provider settings */
const PROVIDER_MAP: Record<string, { imap: ServerConfig; smtp: ServerConfig }> = {
  'gmail.com': {
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.gmail.com', port: 465, secure: true }
  },
  'googlemail.com': {
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.gmail.com', port: 465, secure: true }
  },
  'outlook.com': {
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
    smtp: { host: 'smtp.office365.com', port: 587, secure: false }
  },
  'hotmail.com': {
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
    smtp: { host: 'smtp.office365.com', port: 587, secure: false }
  },
  'live.com': {
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
    smtp: { host: 'smtp.office365.com', port: 587, secure: false }
  },
  'yahoo.com': {
    imap: { host: 'imap.mail.yahoo.com', port: 993, secure: true },
    smtp: { host: 'smtp.mail.yahoo.com', port: 465, secure: true }
  },
  'icloud.com': {
    imap: { host: 'imap.mail.me.com', port: 993, secure: true },
    smtp: { host: 'smtp.mail.me.com', port: 587, secure: false }
  },
  'me.com': {
    imap: { host: 'imap.mail.me.com', port: 993, secure: true },
    smtp: { host: 'smtp.mail.me.com', port: 587, secure: false }
  },
  'zoho.com': {
    imap: { host: 'imap.zoho.com', port: 993, secure: true },
    smtp: { host: 'smtp.zoho.com', port: 465, secure: true }
  },
  'protonmail.com': {
    imap: { host: 'imap.protonmail.ch', port: 993, secure: true },
    smtp: { host: 'smtp.protonmail.ch', port: 465, secure: true }
  }
}

export interface ServerConfig {
  host: string
  port: number
  secure: boolean
}

export interface AccountConfig {
  id: string
  email: string
  password: string
  imap: ServerConfig
  smtp: ServerConfig
}

/**
 * Auto-discover IMAP/SMTP settings from email domain
 */
function discoverSettings(email: string): { imap: ServerConfig; smtp: ServerConfig } | null {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return null

  // Check exact domain match
  if (PROVIDER_MAP[domain]) {
    return PROVIDER_MAP[domain]
  }

  // Check if subdomain matches (e.g. user@work.gmail.com)
  for (const [providerDomain, settings] of Object.entries(PROVIDER_MAP)) {
    if (domain.endsWith(`.${providerDomain}`)) {
      return settings
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
 * Parse EMAIL_CREDENTIALS environment variable
 *
 * Supported formats:
 * - Simple: email1:password1,email2:password2
 * - With custom IMAP host: email1:password1:imap.custom.com,email2:password2
 * - Passwords with commas are NOT supported (use env var per account instead)
 *
 * For passwords containing colons, use the 3-field format to disambiguate:
 *   email:password_with:colon:imap_host
 */
export function parseCredentials(envValue: string): AccountConfig[] {
  if (!envValue || envValue.trim() === '') {
    return []
  }

  const accounts: AccountConfig[] = []
  const entries = envValue.split(',')

  for (const entry of entries) {
    const trimmed = entry.trim()
    if (!trimmed) continue

    const parts = trimmed.split(':')
    if (parts.length < 2) {
      console.error(`Skipping invalid credential entry (expected email:password): ${trimmed.substring(0, 20)}...`)
      continue
    }

    const email = parts[0]!.trim()
    let password: string
    let customImapHost: string | undefined

    if (parts.length === 2) {
      // email:password
      password = parts[1]!
    } else if (parts.length === 3) {
      // Could be email:password:imap_host OR email:password_with_colon
      // Heuristic: if last part looks like a hostname (contains a dot), treat as imap host
      const lastPart = parts[2]!
      if (lastPart.includes('.')) {
        password = parts[1]!
        customImapHost = lastPart
      } else {
        // password contains a colon
        password = `${parts[1]}:${parts[2]}`
      }
    } else {
      // 4+ parts: everything between email and last part (if hostname) is password
      const lastPart = parts[parts.length - 1]!
      if (lastPart.includes('.')) {
        password = parts.slice(1, -1).join(':')
        customImapHost = lastPart
      } else {
        password = parts.slice(1).join(':')
      }
    }

    // Auto-discover or use custom host
    let imap: ServerConfig
    let smtp: ServerConfig

    if (customImapHost) {
      imap = { host: customImapHost, port: 993, secure: true }
      // Guess SMTP from IMAP host
      smtp = { host: customImapHost.replace('imap.', 'smtp.'), port: 587, secure: false }
    } else {
      const discovered = discoverSettings(email)
      if (!discovered) {
        console.error(`Cannot auto-discover settings for ${email}. Use format: email:password:imap.server.com`)
        continue
      }
      imap = discovered.imap
      smtp = discovered.smtp
    }

    accounts.push({
      id: emailToId(email),
      email,
      password,
      imap,
      smtp
    })
  }

  return accounts
}

/**
 * Load and validate configuration from environment
 */
export function loadConfig(): AccountConfig[] {
  const credentials = process.env.EMAIL_CREDENTIALS
  if (!credentials) {
    return []
  }
  return parseCredentials(credentials)
}

export function resolveAccount(accounts: AccountConfig[], query: string): AccountConfig {
  const lower = query.toLowerCase().trim()
  const exact = accounts.filter((a) => a.email.toLowerCase() === lower || a.id === lower)
  if (exact.length === 1) return exact[0]!
  const partial = accounts.filter((a) => a.email.toLowerCase().includes(lower))
  if (partial.length === 0)
    throw new Error(`Account "${query}" not found. Available: ${accounts.map((a) => a.email).join(', ')}`)
  if (partial.length > 1)
    throw new Error(
      `Multiple accounts matched: ${partial.map((a) => a.email).join(', ')}. Specify exact account email.`
    )
  return partial[0]!
}
export function resolveAccounts(accounts: AccountConfig[], query?: string): AccountConfig[] {
  if (!query) return accounts
  const lower = query.toLowerCase().trim()
  const exact = accounts.filter((a) => a.email.toLowerCase() === lower || a.id === lower)
  if (exact.length > 0) return exact
  const partial = accounts.filter((a) => a.email.toLowerCase().includes(lower))
  if (partial.length === 0)
    throw new Error(`Account "${query}" not found. Available: ${accounts.map((a) => a.email).join(', ')}`)
  return partial
}
