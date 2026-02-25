/**
 * OAuth Flow Handler
 * Implements Authorization Code flow with PKCE for email OAuth
 * Uses a local HTTP callback server to receive the authorization code
 */

import { createHash, randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import type { OAuthProviderConfig } from './providers.js'
import { detectProvider } from './providers.js'
import type { OAuthClientConfig, StoredTokens } from './store.js'
import { loadClientConfig, saveTokens } from './store.js'

/**
 * Generate PKCE code verifier and challenge
 */
function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

/**
 * Build the authorization URL for the OAuth provider
 */
function buildAuthUrl(
  provider: OAuthProviderConfig,
  clientConfig: OAuthClientConfig,
  redirectUri: string,
  codeChallenge: string,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: clientConfig.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: provider.scopes.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent'
  })

  return `${provider.authorizationEndpoint}?${params.toString()}`
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCode(
  provider: OAuthProviderConfig,
  clientConfig: OAuthClientConfig,
  code: string,
  redirectUri: string,
  codeVerifier: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const body = new URLSearchParams({
    client_id: clientConfig.clientId,
    client_secret: clientConfig.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code_verifier: codeVerifier
  })

  const response = await fetch(provider.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Token exchange failed (${response.status}): ${errorText}`)
  }

  const data = (await response.json()) as {
    access_token: string
    refresh_token?: string
    expires_in?: number
  }

  if (!data.access_token) {
    throw new Error('No access token in response')
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || '',
    expiresIn: data.expires_in || 3600
  }
}

/**
 * Start a local HTTP server to receive the OAuth callback
 * Returns a promise that resolves with the authorization code
 */
function waitForCallback(port: number, expectedState: string): Promise<{ code: string; close: () => void }> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${port}`)

      if (url.pathname !== '/callback') {
        res.writeHead(404)
        res.end('Not found')
        return
      }

      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const error = url.searchParams.get('error')

      if (error) {
        const description = url.searchParams.get('error_description') || error
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(errorPage(description))
        reject(new Error(`OAuth error: ${description}`))
        return
      }

      if (!code || state !== expectedState) {
        res.writeHead(400, { 'Content-Type': 'text/html' })
        res.end(errorPage('Invalid callback: missing code or state mismatch'))
        reject(new Error('Invalid callback parameters'))
        return
      }

      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(successPage())

      resolve({
        code,
        close: () => server.close()
      })
    })

    server.listen(port, '127.0.0.1', () => {
      // Server is listening
    })

    server.on('error', (err) => {
      reject(new Error(`Failed to start callback server: ${err.message}`))
    })

    // Timeout after 5 minutes
    setTimeout(
      () => {
        server.close()
        reject(new Error('OAuth flow timed out (5 minutes). Please try again.'))
      },
      5 * 60 * 1000
    )
  })
}

/**
 * Find an available port for the callback server
 */
function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (addr && typeof addr !== 'string') {
        const port = addr.port
        server.close(() => resolve(port))
      } else {
        server.close(() => reject(new Error('Could not find available port')))
      }
    })
    server.on('error', reject)
  })
}

/**
 * Success page HTML
 */
function successPage(): string {
  return `<!DOCTYPE html>
<html>
<head><title>Authentication Successful</title></head>
<body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f0fdf4">
<div style="text-align:center;max-width:400px">
<h1 style="color:#16a34a">Authentication Successful</h1>
<p>You can close this window and return to your terminal.</p>
</div>
</body>
</html>`
}

/**
 * Error page HTML
 */
function errorPage(message: string): string {
  return `<!DOCTYPE html>
<html>
<head><title>Authentication Failed</title></head>
<body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#fef2f2">
<div style="text-align:center;max-width:400px">
<h1 style="color:#dc2626">Authentication Failed</h1>
<p>${message}</p>
<p>Please close this window and try again.</p>
</div>
</body>
</html>`
}

// ============================================================================
// Public API
// ============================================================================

export interface OAuthFlowResult {
  email: string
  provider: string
  accessToken: string
  refreshToken: string
  tokenExpiry: number
  scopes: string[]
}

/**
 * Run the complete OAuth authorization flow for an email account
 *
 * 1. Detect provider from email domain
 * 2. Load client credentials
 * 3. Start local callback server
 * 4. Open browser with authorization URL
 * 5. Wait for callback with authorization code
 * 6. Exchange code for tokens
 * 7. Save tokens
 */
export async function runOAuthFlow(email: string): Promise<OAuthFlowResult> {
  // Step 1: Detect provider
  const provider = detectProvider(email)
  if (!provider) {
    throw new Error(
      `OAuth is not supported for ${email}. Supported providers: Gmail (gmail.com), Outlook (outlook.com, hotmail.com, live.com)`
    )
  }

  // Step 2: Load client credentials
  const clientConfig = loadClientConfig(provider.name)
  if (!clientConfig) {
    throw new Error(
      `No OAuth client configured for ${provider.name}. Run the setup first:\n` +
        `  npx @n24q02m/better-email-mcp auth setup ${provider.name}`
    )
  }

  // Step 3: Find available port and start callback server
  const port = await findAvailablePort()
  const redirectUri = `http://localhost:${port}/callback`

  // Step 4: Generate PKCE and state
  const { verifier, challenge } = generatePKCE()
  const state = randomBytes(16).toString('hex')

  // Step 5: Build authorization URL
  const authUrl = buildAuthUrl(provider, clientConfig, redirectUri, challenge, state)

  // Step 6: Open browser
  console.error(`\nOpening browser for ${provider.name} authorization...`)
  console.error(`If the browser does not open, visit this URL:\n`)
  console.error(authUrl)
  console.error('')

  // Dynamic import of 'open' to handle it gracefully
  try {
    const { default: open } = await import('open')
    await open(authUrl)
  } catch {
    // If 'open' package is not available, just print the URL
    console.error('(Could not open browser automatically. Please open the URL above manually.)')
  }

  // Step 7: Wait for callback
  console.error('Waiting for authorization...')
  const { code, close } = await waitForCallback(port, state)

  // Step 8: Exchange code for tokens
  console.error('Exchanging authorization code for tokens...')
  const tokens = await exchangeCode(provider, clientConfig, code, redirectUri, verifier)

  // Close callback server
  close()

  // Step 9: Calculate expiry and save
  const tokenExpiry = Date.now() + tokens.expiresIn * 1000
  const storedTokens: StoredTokens = {
    email,
    provider: provider.name,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tokenExpiry,
    scopes: provider.scopes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  saveTokens(storedTokens)

  console.error(`\nOAuth tokens saved for ${email}`)

  return {
    email,
    provider: provider.name,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tokenExpiry,
    scopes: provider.scopes
  }
}
