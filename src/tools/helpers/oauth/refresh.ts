/**
 * OAuth Token Refresh
 * Handles automatic refresh of expired OAuth access tokens
 */

import { detectProvider } from './providers.js'
import type { StoredTokens } from './store.js'
import { loadClientConfig, loadTokens, saveTokens } from './store.js'

/** Buffer time before expiry to trigger refresh (60 seconds) */
const REFRESH_BUFFER_MS = 60_000

/**
 * Refresh an expired access token using the refresh token
 */
async function refreshAccessToken(
  tokens: StoredTokens
): Promise<{ accessToken: string; expiresIn: number; refreshToken?: string }> {
  const provider = detectProvider(tokens.email)
  if (!provider) {
    throw new Error(`Cannot refresh: unknown provider for ${tokens.email}`)
  }

  const clientConfig = loadClientConfig(provider.name)
  if (!clientConfig) {
    throw new Error(`Cannot refresh: no OAuth client configured for ${provider.name}`)
  }

  if (!tokens.refreshToken) {
    throw new Error(
      `Cannot refresh: no refresh token stored for ${tokens.email}. Re-authenticate with:\n` +
        `  npx @n24q02m/better-email-mcp auth ${tokens.email}`
    )
  }

  const body = new URLSearchParams({
    client_id: clientConfig.clientId,
    client_secret: clientConfig.clientSecret,
    refresh_token: tokens.refreshToken,
    grant_type: 'refresh_token'
  })

  const response = await fetch(provider.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  })

  if (!response.ok) {
    const errorText = await response.text()

    // If refresh token is revoked or expired, need re-auth
    if (response.status === 400 || response.status === 401) {
      throw new Error(
        `Token refresh failed for ${tokens.email}: ${errorText}\n` +
          `Re-authenticate with: npx @n24q02m/better-email-mcp auth ${tokens.email}`
      )
    }

    throw new Error(`Token refresh failed (${response.status}): ${errorText}`)
  }

  const data = (await response.json()) as {
    access_token: string
    refresh_token?: string
    expires_in?: number
  }

  if (!data.access_token) {
    throw new Error('No access token in refresh response')
  }

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 3600,
    // Some providers rotate refresh tokens
    refreshToken: data.refresh_token
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Ensure an OAuth account has a fresh access token
 * Returns the current or refreshed access token
 *
 * Call this before creating IMAP/SMTP connections
 */
export async function ensureFreshToken(email: string): Promise<string> {
  const tokens = loadTokens(email)
  if (!tokens) {
    throw new Error(
      `No OAuth tokens found for ${email}. Authenticate with:\n` + `  npx @n24q02m/better-email-mcp auth ${email}`
    )
  }

  // Check if token is still valid (with buffer)
  if (tokens.tokenExpiry && Date.now() < tokens.tokenExpiry - REFRESH_BUFFER_MS) {
    return tokens.accessToken
  }

  // Token expired or about to expire - refresh it
  const refreshed = await refreshAccessToken(tokens)

  // Update stored tokens
  const updatedTokens: StoredTokens = {
    ...tokens,
    accessToken: refreshed.accessToken,
    tokenExpiry: Date.now() + refreshed.expiresIn * 1000,
    // Update refresh token if rotated
    refreshToken: refreshed.refreshToken || tokens.refreshToken,
    updatedAt: new Date().toISOString()
  }

  saveTokens(updatedTokens)

  return refreshed.accessToken
}

/**
 * Check if an account's tokens need refreshing
 */
export function isTokenExpired(email: string): boolean {
  const tokens = loadTokens(email)
  if (!tokens) return true
  return Date.now() >= tokens.tokenExpiry - REFRESH_BUFFER_MS
}
