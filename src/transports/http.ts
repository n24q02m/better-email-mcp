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

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import { createSession, pollForResult, sendMessage } from '@n24q02m/mcp-relay-core/relay'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { ImapFlow } from 'imapflow'
import { createEmailAuthProvider, requestContext } from '../auth/email-auth-provider.js'
import { loadAllUserCredentials, storeUserCredentials } from '../auth/per-user-credential-store.js'
import { RELAY_SCHEMA } from '../relay-schema.js'
import type { AccountConfig } from '../tools/helpers/config.js'
import { parseCredentials } from '../tools/helpers/config.js'
import { _getPendingAuths, ensureValidToken, isOutlookDomain } from '../tools/helpers/oauth2.js'
import { createMcpServer } from '../tools/registry.js'

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

  const SERVER_NAME = 'better-email-mcp'
  const DEFAULT_RELAY_URL = 'https://better-email-mcp.n24q02m.com'
  // Relay URL: use PUBLIC_URL in production (Caddy proxies /api/sessions to relay server),
  // fall back to DEFAULT_RELAY_URL for local dev
  const relayBaseUrl =
    config.publicUrl.startsWith('http://127.0.0.1') || config.publicUrl.startsWith('http://localhost')
      ? DEFAULT_RELAY_URL
      : config.publicUrl

  const { provider, pendingAuths, authCodes, userAccounts, resolveAccounts } = createEmailAuthProvider({
    dcrSecret: config.dcrSecret,
    publicUrl: config.publicUrl,
    createRelaySession: async () => {
      const session = await createSession(relayBaseUrl, SERVER_NAME, RELAY_SCHEMA)
      return { relayUrl: session.relayUrl, session }
    }
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
    authRateLimit,
    mcpAuthRouter({
      provider,
      issuerUrl: serverUrl,
      serviceDocumentationUrl: new URL('https://github.com/n24q02m/better-email-mcp'),
      scopesSupported: ['email:read', 'email:write'],
      resourceName: 'Better Email MCP Server'
    })
  )

  // Background relay poller: polls mcp-relay-core for credentials when a relay session is active
  // Runs for each pending auth that has a relay session
  async function pollRelayAndCompleteAuth(ourState: string) {
    const pending = pendingAuths.get(ourState)
    if (!pending?.relaySession) return

    try {
      const config = await pollForResult(relayBaseUrl, pending.relaySession, 2000, 300_000)
      const credentials = config.EMAIL_CREDENTIALS
      if (!credentials) {
        console.error(`Relay session ${pending.relaySession.sessionId}: no EMAIL_CREDENTIALS in result`)
        return
      }

      // Parse and validate credentials (same flow as stdio relay-setup.ts)
      const accounts = await parseCredentials(credentials)
      if (accounts.length === 0) {
        await sendMessage(relayBaseUrl, pending.relaySession.sessionId, {
          type: 'error',
          text: 'No valid email accounts found. Check format: email:password'
        }).catch(() => {})
        return
      }

      const sessionId = pending.relaySession.sessionId

      // Validate non-OAuth accounts via IMAP (parallel for multi-account)
      const imapResults = await Promise.all(
        accounts.map(async (account) => {
          if (!isOutlookDomain(account.email) && account.authType !== 'oauth2') {
            const valid = await testImapConnection(account)
            return { email: account.email, valid }
          }
          return { email: account.email, valid: true }
        })
      )

      const failed = imapResults.find((r) => !r.valid)
      if (failed) {
        await sendMessage(relayBaseUrl, sessionId, {
          type: 'error',
          text: `IMAP connection failed for ${failed.email}. Check email and app password.`
        }).catch(() => {})
        return
      }

      // Trigger Outlook OAuth Device Code flow for Outlook accounts (parallel for multi-account)
      let hasOAuthPending = false
      await Promise.all(
        accounts.map(async (account) => {
          if (isOutlookDomain(account.email) && !account.oauth2) {
            try {
              await ensureValidToken(account)
            } catch (err: any) {
              const message = err?.message || ''
              const urlMatch = message.match(/Visit:\s*(https?:\/\/\S+)/)
              const codeMatch = message.match(/Enter code:\s*(\S+)/)
              if (urlMatch && codeMatch) {
                hasOAuthPending = true
                await sendMessage(relayBaseUrl, sessionId, {
                  type: 'oauth_device_code',
                  text: `Sign in to Microsoft for ${account.email}`,
                  data: { url: urlMatch[1], code: codeMatch[1], email: account.email }
                }).catch(() => {})
                console.info(`OAuth device code sent to relay page for ${account.email}`)
              }
            }
          }
        })
      )

      // Wait for OAuth to complete if needed
      if (hasOAuthPending) {
        const pendingOAuths = _getPendingAuths()
        const oauthDeadline = Date.now() + 10 * 60 * 1000
        while (pendingOAuths.size > 0 && Date.now() < oauthDeadline) {
          await new Promise((r) => setTimeout(r, 2000))
        }
      }

      // Issue auth code
      const userId = randomBytes(16).toString('hex')
      userAccounts.set(userId, accounts)
      await storeUserCredentials(userId, accounts)
      pendingAuths.delete(ourState)

      const ourAuthCode = randomBytes(32).toString('hex')
      authCodes.set(ourAuthCode, {
        userId,
        codeChallenge: pending.codeChallenge,
        codeChallengeMethod: pending.codeChallengeMethod,
        clientId: pending.clientId,
        createdAt: Date.now()
      })

      // Build redirect URL
      const clientRedirect = new URL(pending.clientRedirectUri)
      clientRedirect.searchParams.set('code', ourAuthCode)
      if (pending.clientState) clientRedirect.searchParams.set('state', pending.clientState)

      // Send redirect URL to relay page via bidirectional messaging
      await sendMessage(relayBaseUrl, sessionId, {
        type: 'complete',
        text: hasOAuthPending
          ? 'All accounts configured including OAuth! Redirecting...'
          : 'Email credentials validated! Redirecting...',
        data: { redirect: clientRedirect.toString() }
      }).catch(() => {})

      console.info(`Relay auth completed for user (userId: ${userId.substring(0, 8)}...)`)
    } catch (err: any) {
      if (err?.message === 'RELAY_SKIPPED') {
        console.info('Relay setup skipped by user')
      } else {
        console.error('Relay poll error:', err?.message ?? err)
      }
      pendingAuths.delete(ourState)
    }
  }

  // Watch for new relay sessions and start polling
  const originalSet = pendingAuths.set.bind(pendingAuths)
  pendingAuths.set = (key: string, value: any) => {
    const result = originalSet(key, value)
    if (value.relaySession) {
      pollRelayAndCompleteAuth(key).catch(console.error)
    }
    return result
  }

  const jsonParser = express.json()

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
      const server = createMcpServer(accounts)
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
