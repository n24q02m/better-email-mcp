/**
 * OAuth2 for Outlook.com / Hotmail / Live accounts
 *
 * Microsoft deprecated Basic Auth for consumer IMAP/SMTP.
 * This module implements Device Code Grant (RFC 8628) for CLI-based auth,
 * persistent token storage, and automatic token refresh.
 */

import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// Microsoft OAuth2 endpoints — "consumers" tenant for personal Microsoft accounts
const TENANT = 'consumers'
const AUTH_BASE = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0`
const DEVICE_CODE_URL = `${AUTH_BASE}/devicecode`
const TOKEN_URL = `${AUTH_BASE}/token`

// IMAP + SMTP + offline_access (for refresh tokens)
// Full resource URL with outlook.office.com — required for personal Microsoft accounts.
// outlook.office.com (personal/MSA) vs outlook.office365.com (work/school/Entra ID).
// Short scopes (no URL) produce Microsoft Graph tokens that Exchange Online IMAP rejects.
const SCOPES = [
  'https://outlook.office.com/IMAP.AccessAsUser.All',
  'https://outlook.office.com/SMTP.Send',
  'offline_access'
]

// Time constants
const MS_PER_SECOND = 1000
const DEFAULT_POLLING_INTERVAL_SECONDS = 5
const SLOW_DOWN_BACKOFF_MS = 5000
const TOKEN_REFRESH_BUFFER_SECONDS = 300

// Persistent token storage
const CONFIG_DIR = join(homedir(), '.better-email-mcp')
const TOKEN_FILE = join(CONFIG_DIR, 'tokens.json')

export interface OAuth2Tokens {
  accessToken: string
  refreshToken: string
  expiresAt: number // Unix timestamp (seconds)
  clientId: string
}

interface TokenStore {
  [email: string]: OAuth2Tokens
}

interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
  message: string
  error?: string
  error_description?: string
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  error?: string
  error_description?: string
}

/** Outlook/Hotmail/Live domains that require OAuth2 */
const OUTLOOK_DOMAINS = new Set(['outlook.com', 'hotmail.com', 'live.com'])

/**
 * Check if an email address belongs to an Outlook/Hotmail/Live domain
 */
export function isOutlookDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  return domain ? OUTLOOK_DOMAINS.has(domain) : false
}

// Bundled Azure AD public client ID for better-email-mcp.
// Public clients have no secret — this is safe to embed (like Thunderbird's client ID).
// Override with OUTLOOK_CLIENT_ID env var if you want to use your own Azure AD app.
const DEFAULT_CLIENT_ID = 'd56f8c71-9f7c-43f4-9934-be29cb6e77b0'

/**
 * Get the Azure AD client ID for OAuth2.
 * Uses bundled client ID by default, can be overridden via OUTLOOK_CLIENT_ID env var.
 */
export function getClientId(): string {
  return process.env.OUTLOOK_CLIENT_ID || DEFAULT_CLIENT_ID
}

/**
 * Load stored OAuth2 tokens for an email account.
 * Returns null if no tokens are stored.
 */
export function loadStoredTokens(email: string): OAuth2Tokens | null {
  try {
    if (!existsSync(TOKEN_FILE)) return null
    const store: TokenStore = JSON.parse(readFileSync(TOKEN_FILE, 'utf-8'))
    return store[email.toLowerCase()] || null
  } catch {
    return null
  }
}

/**
 * Persist OAuth2 tokens to disk.
 * Creates config directory if needed. File permissions: 0600.
 */
export function saveTokens(email: string, tokens: OAuth2Tokens): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })
  }

  let store: TokenStore = {}
  try {
    if (existsSync(TOKEN_FILE)) {
      store = JSON.parse(readFileSync(TOKEN_FILE, 'utf-8'))
    }
  } catch {
    // Start fresh if file is corrupted
  }

  store[email.toLowerCase()] = tokens
  writeFileSync(TOKEN_FILE, JSON.stringify(store, null, 2), { mode: 0o600 })
}

/**
 * Refresh an access token using the stored refresh token.
 * Microsoft may rotate the refresh token on each use.
 */
export async function refreshAccessToken(clientId: string, refreshToken: string): Promise<TokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: SCOPES.join(' ')
    })
  })

  const data = (await response.json()) as TokenResponse

  if (data.error) {
    throw new Error(`Token refresh failed: ${data.error_description || data.error}`)
  }

  return data
}

/**
 * Track pending Device Code auth flows so we don't request new codes on every retry.
 * Maps email → { verificationUri, userCode, expiresAt }
 */
interface PendingAuth {
  verificationUri: string
  userCode: string
  expiresAt: number
}
const pendingAuths = new Map<string, PendingAuth>()

/** Exposed for testing */
export function _getPendingAuths(): Map<string, PendingAuth> {
  return pendingAuths
}

/**
 * Open a URL in the user's default browser.
 * Fire-and-forget — errors are silently ignored since stderr instructions
 * serve as fallback if the browser fails to open.
 */
function openBrowser(url: string): void {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return
    }
  } catch {
    return
  }

  if (process.platform === 'darwin') {
    execFile('open', [url], () => {})
  } else if (process.platform === 'win32') {
    // On Windows, use rundll32 to open URLs safely without cmd.exe
    execFile('rundll32', ['url.dll,FileProtocolHandler', url], () => {})
  } else {
    execFile('xdg-open', [url], () => {})
  }
}

/**
 * Request a device code from Microsoft's OAuth2 endpoint.
 */
async function requestDeviceCode(clientId: string): Promise<DeviceCodeResponse> {
  const response = await fetch(DEVICE_CODE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      scope: SCOPES.join(' ')
    })
  })

  const data = (await response.json()) as DeviceCodeResponse

  if (data.error || !data.user_code) {
    throw new Error(`Device code request failed: ${data.error_description || data.error || 'Unknown error'}`)
  }

  return data
}

/**
 * Poll for token in the background. Saves to disk when authorized.
 * Runs silently — errors are logged to stderr, not thrown.
 */
function startBackgroundPoll(
  clientId: string,
  deviceCode: string,
  interval: number,
  expiresIn: number,
  email: string
): void {
  const emailKey = email.toLowerCase()
  const deadline = Date.now() + expiresIn * MS_PER_SECOND
  let pollInterval = (interval || DEFAULT_POLLING_INTERVAL_SECONDS) * MS_PER_SECOND

  const poll = async () => {
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval))

      const response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: deviceCode
        })
      })

      const data = (await response.json()) as TokenResponse

      if (data.access_token) {
        const now = Math.floor(Date.now() / MS_PER_SECOND)
        saveTokens(email, {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: now + data.expires_in,
          clientId
        })
        pendingAuths.delete(emailKey)
        return
      }

      if (data.error === 'authorization_pending') continue
      if (data.error === 'slow_down') {
        pollInterval += SLOW_DOWN_BACKOFF_MS
        continue
      }

      // authorization_declined, expired_token, etc.
      pendingAuths.delete(emailKey)
      return
    }

    pendingAuths.delete(emailKey)
  }

  poll().catch(() => pendingAuths.delete(emailKey))
}

/**
 * Ensure the account has a valid (non-expired) access token.
 *
 * If no tokens exist: initiates Device Code flow in the background and throws
 * an error containing the sign-in URL and code for the MCP client to display.
 * On retry, picks up tokens saved to disk by the background poll.
 *
 * If tokens exist but expired: refreshes automatically with 5-minute buffer.
 * Mutates account.oauth2 in place and persists to disk.
 */
export async function ensureValidToken(account: { email: string; oauth2?: OAuth2Tokens }): Promise<string> {
  // Try loading from disk (background auth may have saved tokens since last call)
  if (!account.oauth2) {
    const stored = loadStoredTokens(account.email)
    if (stored) {
      account.oauth2 = stored
    }
  }

  if (!account.oauth2) {
    const emailKey = account.email.toLowerCase()
    const pending = pendingAuths.get(emailKey)

    if (pending && pending.expiresAt > Date.now()) {
      // Auth flow already in progress — show same code
      throw new Error(
        `Outlook sign-in in progress for ${account.email}.\n` +
          `Visit: ${pending.verificationUri}\n` +
          `Enter code: ${pending.userCode}\n\n` +
          `After signing in, retry your request.`
      )
    }

    // Start new Device Code flow
    const clientId = getClientId()
    const codeData = await requestDeviceCode(clientId)

    pendingAuths.set(emailKey, {
      verificationUri: codeData.verification_uri,
      userCode: codeData.user_code,
      expiresAt: Date.now() + codeData.expires_in * MS_PER_SECOND
    })

    startBackgroundPoll(clientId, codeData.device_code, codeData.interval, codeData.expires_in, account.email)

    // Auto-open browser for desktop environments
    openBrowser(codeData.verification_uri)

    throw new Error(
      `Outlook OAuth2 sign-in required for ${account.email}.\n` +
        `Visit: ${codeData.verification_uri}\n` +
        `Enter code: ${codeData.user_code}\n\n` +
        `After signing in, retry your request.`
    )
  }

  const now = Math.floor(Date.now() / MS_PER_SECOND)
  const buffer = TOKEN_REFRESH_BUFFER_SECONDS // 5-minute safety buffer

  if (account.oauth2.expiresAt > now + buffer) {
    return account.oauth2.accessToken
  }

  // Token expired or about to expire — refresh
  const newTokens = await refreshAccessToken(account.oauth2.clientId, account.oauth2.refreshToken)

  account.oauth2.accessToken = newTokens.access_token
  account.oauth2.expiresAt = now + newTokens.expires_in
  // Microsoft may issue a new refresh token — always update if provided
  if (newTokens.refresh_token) {
    account.oauth2.refreshToken = newTokens.refresh_token
  }

  // Persist updated tokens
  saveTokens(account.email, account.oauth2)

  return newTokens.access_token
}

/**
 * Interactive Device Code flow for CLI-based OAuth2 authentication.
 * Prints instructions to stderr and polls until user authorizes or timeout.
 * Used by `npx @n24q02m/better-email-mcp auth <email>`.
 */
export async function deviceCodeAuth(email: string, clientId?: string): Promise<OAuth2Tokens> {
  const resolvedClientId = clientId || getClientId()
  const codeData = await requestDeviceCode(resolvedClientId)

  console.error(`\nTo sign in, visit: ${codeData.verification_uri}`)
  console.error(`Enter code: ${codeData.user_code}\n`)
  console.error('Waiting for authorization...')

  const interval = (codeData.interval || DEFAULT_POLLING_INTERVAL_SECONDS) * MS_PER_SECOND
  const deadline = Date.now() + codeData.expires_in * MS_PER_SECOND
  let pollInterval = interval

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval))

    const tokenResponse = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: resolvedClientId,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: codeData.device_code
      })
    })

    const tokenData = (await tokenResponse.json()) as TokenResponse

    if (tokenData.access_token) {
      const now = Math.floor(Date.now() / MS_PER_SECOND)
      const tokens: OAuth2Tokens = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: now + tokenData.expires_in,
        clientId: resolvedClientId
      }

      saveTokens(email, tokens)
      console.error(`\nSuccess! Token saved for ${email}`)
      return tokens
    }

    if (tokenData.error === 'authorization_pending') {
      continue
    }

    if (tokenData.error === 'slow_down') {
      pollInterval += SLOW_DOWN_BACKOFF_MS // Back off as requested by server
      continue
    }

    // Other errors (expired_token, authorization_declined, bad_verification_code)
    throw new Error(`Authorization failed: ${tokenData.error_description || tokenData.error}`)
  }

  throw new Error('Authorization timed out. Please try again.')
}
