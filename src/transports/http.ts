/**
 * HTTP Transport -- Multi-user remote mode with OAuth 2.1
 *
 * Express server with email credential relay, Streamable HTTP transport,
 * and per-user session management. Follows the same pattern as better-notion-mcp.
 *
 * Auth flow:
 * 1. MCP client registers via DCR (stateless HMAC)
 * 2. MCP client calls /authorize -> redirect to relay credential entry page
 * 3. User submits email credentials via POST /auth/credentials
 * 4. Server validates credentials by testing IMAP connection
 * 5. Server issues auth code, redirects back to MCP client
 * 6. MCP client exchanges auth code for bearer token
 * 7. POST /mcp with bearer token -> per-user AccountConfig[] resolved
 */

import { randomBytes, randomUUID } from 'node:crypto'
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js'
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { ImapFlow } from 'imapflow'
import { createEmailAuthProvider, requestContext } from '../auth/email-auth-provider.js'
import { loadAllUserCredentials, storeUserCredentials } from '../auth/per-user-credential-store.js'
import type { AccountConfig } from '../tools/helpers/config.js'
import { parseCredentials } from '../tools/helpers/config.js'
import { registerTools } from '../tools/registry.js'

interface HttpConfig {
  port: number
  publicUrl: string
  dcrSecret: string
}

function loadConfig(): HttpConfig {
  const required = ['PUBLIC_URL', 'DCR_SERVER_SECRET'] as const

  for (const key of required) {
    if (!process.env[key]) {
      console.error(`Missing required env var: ${key}`)
      process.exit(1)
    }
  }

  return {
    port: parseInt(process.env.PORT ?? '8080', 10),
    publicUrl: process.env.PUBLIC_URL!,
    dcrSecret: process.env.DCR_SERVER_SECRET!
  }
}

function getVersion(): string {
  try {
    return process.env.npm_package_version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

function createMCPServer(accounts: AccountConfig[]): Server {
  const server = new Server(
    {
      name: '@n24q02m/better-email-mcp',
      version: getVersion()
    },
    {
      capabilities: {
        tools: {},
        resources: {}
      }
    }
  )
  registerTools(server, accounts)
  return server
}

/**
 * Test IMAP connection to validate email credentials.
 * Returns true if credentials are valid, false otherwise.
 */
async function testImapConnection(account: AccountConfig): Promise<boolean> {
  const client = new ImapFlow({
    host: account.imap.host,
    port: account.imap.port,
    secure: account.imap.secure,
    auth: {
      user: account.email,
      pass: account.password
    },
    logger: false
  })

  try {
    await client.connect()
    await client.logout()
    return true
  } catch {
    return false
  }
}

export async function startHttp(): Promise<void> {
  const config = loadConfig()
  const serverUrl = new URL(config.publicUrl)

  const { provider, pendingAuths, authCodes, userAccounts, resolveAccounts } = createEmailAuthProvider({
    dcrSecret: config.dcrSecret,
    publicUrl: config.publicUrl
  })

  // Restore persisted per-user credentials on startup
  try {
    const stored = await loadAllUserCredentials()
    for (const [userId, accounts] of stored) {
      userAccounts.set(userId, accounts)
    }
    if (stored.size > 0) {
      console.info(`Restored ${stored.size} user credential set(s) from disk`)
    }
  } catch (err) {
    console.error('Failed to restore user credentials:', err)
  }

  const app = express()

  // Trust exactly 2 reverse proxies (Cloudflare + Caddy) for correct req.ip
  app.set('trust proxy', 2)
  app.disable('x-powered-by')

  // Rate limit MCP endpoints per IP
  const mcpRateLimit = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false
  })

  // Rate limit auth endpoints per IP to prevent abuse/brute-force
  const authRateLimit = rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false
  })

  // Propagate request IP via AsyncLocalStorage for IP-scoped pending binds
  app.use((req, _res, next) => {
    const ip = req.ip || req.socket.remoteAddress || undefined
    requestContext.run({ ip }, next)
  })

  // OAuth endpoints (/.well-known/*, /authorize, /token, /register)
  app.use(
    mcpAuthRouter({
      provider,
      issuerUrl: serverUrl,
      serviceDocumentationUrl: new URL('https://github.com/n24q02m/better-email-mcp'),
      scopesSupported: ['email:read', 'email:write'],
      resourceName: 'Better Email MCP Server'
    })
  )

  // Relay credential entry page -- simple HTML form for email credentials
  app.get('/auth/relay', authRateLimit, (req, res) => {
    const state = req.query.state as string
    if (!state) {
      res.status(400).json({ error: 'missing_state', error_description: 'Missing state parameter' })
      return
    }

    // Serve a simple credential entry form
    res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Email MCP - Sign In</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #f5f5f5; min-height: 100vh;
           display: flex; align-items: center; justify-content: center; padding: 1rem; }
    .card { background: white; border-radius: 12px; padding: 2rem; max-width: 480px; width: 100%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    p { color: #666; font-size: 0.875rem; margin-bottom: 1.5rem; }
    label { display: block; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.25rem; }
    input { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #ddd; border-radius: 6px;
            font-size: 0.875rem; margin-bottom: 1rem; }
    input:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,0.2); }
    button { width: 100%; padding: 0.625rem; background: #2563eb; color: white; border: none;
             border-radius: 6px; font-size: 0.875rem; font-weight: 500; cursor: pointer; }
    button:hover { background: #1d4ed8; }
    button:disabled { background: #93c5fd; cursor: not-allowed; }
    .error { color: #dc2626; font-size: 0.8rem; margin-bottom: 1rem; display: none; }
    .help { color: #666; font-size: 0.75rem; margin-top: -0.5rem; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Email MCP Server</h1>
    <p>Enter your email credentials to connect. Use an App Password for Gmail/Yahoo/iCloud.</p>
    <div class="error" id="error"></div>
    <form id="form">
      <label for="credentials">Email Credentials</label>
      <input type="text" id="credentials" name="credentials" required
             placeholder="user@gmail.com:app-password" autocomplete="off">
      <div class="help">Format: email:password. Multiple: email1:pass1,email2:pass2</div>
      <button type="submit" id="submit">Connect</button>
    </form>
  </div>
  <script>
    const form = document.getElementById('form');
    const btn = document.getElementById('submit');
    const errEl = document.getElementById('error');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      btn.disabled = true;
      btn.textContent = 'Validating...';
      errEl.style.display = 'none';
      try {
        const res = await fetch('/auth/credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            state: '${state}',
            credentials: document.getElementById('credentials').value
          })
        });
        const data = await res.json();
        if (data.redirect) {
          window.location.href = data.redirect;
        } else {
          errEl.textContent = data.error_description || data.error || 'Unknown error';
          errEl.style.display = 'block';
          btn.disabled = false;
          btn.textContent = 'Connect';
        }
      } catch (err) {
        errEl.textContent = 'Network error. Please try again.';
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Connect';
      }
    });
  </script>
</body>
</html>`)
  })

  // Credential submission endpoint -- validates and issues auth code
  const jsonParser = express.json()
  app.post('/auth/credentials', authRateLimit, jsonParser, async (req, res) => {
    const { state, credentials } = req.body as { state?: string; credentials?: string }

    if (!state || !credentials) {
      res.status(400).json({ error: 'invalid_request', error_description: 'Missing state or credentials' })
      return
    }

    // Look up the pending auth
    const pending = pendingAuths.get(state)
    if (!pending) {
      res.status(400).json({ error: 'invalid_state', error_description: 'Unknown or expired state' })
      return
    }

    try {
      // Parse credentials into AccountConfig[]
      const accounts = await parseCredentials(credentials)
      if (accounts.length === 0) {
        res.status(400).json({
          error: 'invalid_credentials',
          error_description: 'No valid email accounts found. Check format: email:password'
        })
        return
      }

      // Validate at least the first account via IMAP
      const firstAccount = accounts[0]!
      // Skip IMAP test for OAuth2 accounts (Outlook) -- they use device code flow
      if (firstAccount.authType !== 'oauth2') {
        const valid = await testImapConnection(firstAccount)
        if (!valid) {
          res.status(400).json({
            error: 'invalid_credentials',
            error_description: `IMAP connection failed for ${firstAccount.email}. Check email and password (use App Password for Gmail).`
          })
          return
        }
      }

      // Generate a userId based on the credentials
      const userId = randomBytes(16).toString('hex')

      // Store accounts for this user
      userAccounts.set(userId, accounts)

      // Persist to disk
      await storeUserCredentials(userId, accounts)

      // Consume the pending auth
      pendingAuths.delete(state)

      // Issue our own auth code
      const ourAuthCode = randomBytes(32).toString('hex')
      authCodes.set(ourAuthCode, {
        userId,
        codeChallenge: pending.codeChallenge,
        codeChallengeMethod: pending.codeChallengeMethod,
        clientId: pending.clientId,
        createdAt: Date.now()
      })

      // Build redirect URL back to MCP client
      const clientRedirect = new URL(pending.clientRedirectUri)

      // Prevent XSS and Open Redirect via unsafe protocols
      const protocol = clientRedirect.protocol.toLowerCase()
      if (['javascript:', 'data:', 'vbscript:', 'file:'].includes(protocol)) {
        res.status(400).json({ error: 'invalid_request', error_description: 'Unsafe redirect URI' })
        return
      }

      clientRedirect.searchParams.set('code', ourAuthCode)
      if (pending.clientState) {
        clientRedirect.searchParams.set('state', pending.clientState)
      }

      res.json({ redirect: clientRedirect.toString() })
    } catch (err: any) {
      console.error('Credential submission error:', err)
      res.status(500).json({ error: 'server_error', error_description: 'Failed to validate credentials' })
    }
  })

  const authMiddleware = requireBearerAuth({ verifier: provider })
  const transports: Map<string, StreamableHTTPServerTransport> = new Map()
  // Session owner binding -- prevents cross-user session hijacking
  const sessionOwners: Map<string, string> = new Map() // sessionId -> userId

  // MCP endpoint -- POST (new session or existing)
  app.post('/mcp', mcpRateLimit, jsonParser, authMiddleware, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined

    // Existing session -- verify the authenticated user owns this session
    if (sessionId && transports.has(sessionId)) {
      const authInfo = (req as any).auth
      const ownerUserId = sessionOwners.get(sessionId)
      if (ownerUserId) {
        const currentUserId = authInfo?.extra?.userId
        if (currentUserId !== ownerUserId) {
          res.status(403).json({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Session belongs to a different user' },
            id: null
          })
          return
        }
      }
      await transports.get(sessionId)!.handleRequest(req, res, req.body)
      return
    }

    // New session -- must be initialize request
    if (!sessionId && isInitializeRequest(req.body)) {
      const authInfo = (req as any).auth
      const userId: string = authInfo.extra?.userId
      const accounts = resolveAccounts(authInfo.token)

      if (!accounts || accounts.length === 0) {
        res.status(403).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'No email accounts found. Please re-authenticate.' },
          id: null
        })
        return
      }

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          transports.set(id, transport)
          sessionOwners.set(id, userId)
        }
      })

      transport.onclose = () => {
        if (transport.sessionId) {
          transports.delete(transport.sessionId)
          sessionOwners.delete(transport.sessionId)
        }
      }

      // Per-session MCP server with the user's email accounts
      const server = createMCPServer(accounts)
      await server.connect(transport)
      await transport.handleRequest(req, res, req.body)
      return
    }

    res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Bad request: missing session ID or not an initialize request' },
      id: null
    })
  })

  // Verify session ownership for GET/DELETE endpoints
  function verifySessionOwner(req: express.Request, res: express.Response, sessionId: string): boolean {
    const authInfo = (req as any).auth
    const ownerUserId = sessionOwners.get(sessionId)
    if (ownerUserId) {
      const currentUserId = authInfo?.extra?.userId
      if (currentUserId !== ownerUserId) {
        res.status(403).json({ error: 'Session belongs to a different user' })
        return false
      }
    }
    return true
  }

  // MCP endpoint -- GET (SSE streaming for existing session)
  app.get('/mcp', mcpRateLimit, authMiddleware, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string
    if (sessionId && transports.has(sessionId)) {
      if (!verifySessionOwner(req, res, sessionId)) return
      await transports.get(sessionId)!.handleRequest(req, res)
    } else {
      res.status(400).json({ error: 'Invalid or missing session' })
    }
  })

  // MCP endpoint -- DELETE (close session)
  app.delete('/mcp', mcpRateLimit, authMiddleware, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string
    if (sessionId && transports.has(sessionId)) {
      if (!verifySessionOwner(req, res, sessionId)) return
      await transports.get(sessionId)!.handleRequest(req, res)
    } else {
      res.status(400).json({ error: 'Invalid or missing session' })
    }
  })

  // Health check (no auth required)
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      mode: 'http',
      users: userAccounts.size,
      timestamp: new Date().toISOString()
    })
  })

  app.listen(config.port, '0.0.0.0', () => {
    console.info(`Email MCP HTTP server listening on port ${config.port}`)
    console.info(`Public URL: ${config.publicUrl}`)
    console.info(`Users: ${userAccounts.size}`)
  })
}
