/**
 * OAuth2 for Outlook.com / Hotmail / Live accounts
 *
 * Microsoft deprecated Basic Auth for consumer IMAP/SMTP.
 * This module implements Device Code Grant (RFC 8628) for CLI-based auth,
 * persistent token storage, and automatic token refresh.
 */

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

/**
 * Get the Azure AD client ID for OAuth2.
 * Reads from OUTLOOK_CLIENT_ID env var.
 */
export function getClientId(): string {
  const clientId = process.env.OUTLOOK_CLIENT_ID
  if (clientId) return clientId

  throw new Error(
    'OUTLOOK_CLIENT_ID environment variable is required for Outlook OAuth2.\n' +
      'Register a public client app at https://portal.azure.com > App registrations:\n' +
      '  - Supported account types: Accounts in any org directory + personal Microsoft accounts\n' +
      '  - Authentication: Enable "Allow public client flows"\n' +
      '  - API permissions: Microsoft Graph > Delegated: IMAP.AccessAsUser.All, SMTP.Send\n' +
      'Then set OUTLOOK_CLIENT_ID to the Application (client) ID.'
  )
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
 * Ensure the account has a valid (non-expired) access token.
 * Refreshes automatically if expired or within 5-minute buffer.
 * Mutates account.oauth2 in place and persists to disk.
 */
export async function ensureValidToken(account: { email: string; oauth2?: OAuth2Tokens }): Promise<string> {
  if (!account.oauth2) {
    throw new Error(`No OAuth2 tokens for ${account.email}. Run: npx @n24q02m/better-email-mcp auth ${account.email}`)
  }

  const now = Math.floor(Date.now() / 1000)
  const buffer = 300 // 5-minute safety buffer

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
 * Interactive Device Code flow for Outlook OAuth2 authentication.
 * Prints instructions to stderr and polls until user authorizes or timeout.
 */
export async function deviceCodeAuth(email: string, clientId?: string): Promise<OAuth2Tokens> {
  const resolvedClientId = clientId || getClientId()

  // Step 1: Request device code
  const codeResponse = await fetch(DEVICE_CODE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: resolvedClientId,
      scope: SCOPES.join(' ')
    })
  })

  const codeData = (await codeResponse.json()) as DeviceCodeResponse

  if (codeData.error || !codeData.user_code) {
    throw new Error(`Device code request failed: ${codeData.error_description || codeData.error || 'Unknown error'}`)
  }

  console.error(`\nTo sign in, visit: ${codeData.verification_uri}`)
  console.error(`Enter code: ${codeData.user_code}\n`)
  console.error('Waiting for authorization...')

  // Step 2: Poll for token at the specified interval
  const interval = (codeData.interval || 5) * 1000
  const deadline = Date.now() + codeData.expires_in * 1000
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
      const now = Math.floor(Date.now() / 1000)
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
      pollInterval += 5000 // Back off as requested by server
      continue
    }

    // Other errors (expired_token, authorization_declined, bad_verification_code)
    throw new Error(`Authorization failed: ${tokenData.error_description || tokenData.error}`)
  }

  throw new Error('Authorization timed out. Please try again.')
}
