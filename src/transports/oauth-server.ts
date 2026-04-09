import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import path from 'node:path'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import {
  createSession,
  JWTIssuer,
  pollForResult,
  type RelaySession,
  SqliteUserStore,
  sendMessage
} from '@n24q02m/mcp-relay-core'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { ImapFlow } from 'imapflow'

// Internal imports
import { RELAY_SCHEMA } from '../relay-schema.js'
import type { AccountConfig } from '../tools/helpers/config.js'
import { parseCredentials } from '../tools/helpers/config.js'
import { _getPendingAuths, ensureValidToken, isOutlookDomain } from '../tools/helpers/oauth2.js'
import { registerTools } from '../tools/registry.js'

const _AUTH_CODE_TTL = 10 * 60 * 1000

export async function startOAuthHttp(): Promise<void> {
  const port = parseInt(process.env.PORT ?? '8080', 10)
  const publicUrl = process.env.PUBLIC_URL!
  const masterSecret = process.env.DCR_SERVER_SECRET || process.env.MASTER_SECRET || 'dev-secret'

  if (!publicUrl || !masterSecret) {
    console.error('Missing PUBLIC_URL or DCR_SERVER_SECRET')
    process.exit(1)
  }

  const app = express()
  const dataDir = process.env.APP_DATA_DIR || path.join(process.cwd(), '.better-email-mcp')

  const issuer = new JWTIssuer('better-email-mcp', path.join(dataDir, 'keys'))
  await issuer.init()

  const masterKeyBits = createHash('sha256').update(masterSecret).digest()
  const userStore = new SqliteUserStore(path.join(dataDir, 'users.db'), masterKeyBits)

  // Standard security headers
  app.use((_req, res, next) => {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Content-Security-Policy', "default-src 'self'")
    next()
  })

  app.set('trust proxy', 2)
  app.disable('x-powered-by')

  const mcpRateLimit = rateLimit({ windowMs: 60 * 1000, limit: 120 })
  const authRateLimit = rateLimit({ windowMs: 60 * 1000, limit: 20 })

  const jsonParser = express.json()
  const urlencodedParser = express.urlencoded({ extended: false })

  const relayBaseUrl =
    publicUrl.startsWith('http://127.0.0.1') || publicUrl.startsWith('http://localhost')
      ? 'https://better-email-mcp.n24q02m.com'
      : publicUrl

  interface PendingAuth {
    clientId: string
    redirectUri: string
    state?: string
    codeChallenge: string
    codeChallengeMethod: string
    relaySession: RelaySession
    createdAt: number
  }

  const pendingAuths = new Map<string, PendingAuth>() // state -> PendingAuth
  const authCodes = new Map<
    string,
    { userId: string; challenge: string; challengeMethod: string; clientId: string; createdAt: number }
  >()

  async function testImap(account: AccountConfig): Promise<boolean> {
    const client = new ImapFlow({
      host: account.imap.host,
      port: account.imap.port,
      secure: account.imap.secure,
      auth: { user: account.email, pass: account.password },
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

  // Poller function
  async function pollRelayAndCompleteAuth(stateKey: string) {
    const pending = pendingAuths.get(stateKey)
    if (!pending) return

    try {
      const config = await pollForResult(relayBaseUrl, pending.relaySession, 2000, 300_000)
      const credentials = config.EMAIL_CREDENTIALS
      if (!credentials) return

      const accounts = await parseCredentials(credentials)
      const sessionId = pending.relaySession.sessionId

      if (accounts.length === 0) {
        await sendMessage(relayBaseUrl, sessionId, {
          type: 'error',
          text: 'No valid email accounts found. Check format: email:password'
        }).catch(() => {})
        return
      }

      // Check IMAP
      const imapResults = await Promise.all(
        accounts.map(async (acc) => {
          if (!isOutlookDomain(acc.email) && acc.authType !== 'oauth2') {
            return { valid: await testImap(acc), email: acc.email }
          }
          return { valid: true, email: acc.email }
        })
      )

      const failed = imapResults.find((r) => !r.valid)
      if (failed) {
        await sendMessage(relayBaseUrl, sessionId, {
          type: 'error',
          text: `IMAP connection failed for ${failed.email}. Check credentials.`
        }).catch(() => {})
        return
      }

      // OAuth device code handling for Outlook
      let hasOAuthPending = false
      await Promise.all(
        accounts.map(async (acc) => {
          if (isOutlookDomain(acc.email) && !acc.oauth2) {
            try {
              await ensureValidToken(acc)
            } catch (err: any) {
              const msg = err?.message || ''
              const urlMatch = msg.match(/Visit:\s*(https?:\/\/\S+)/)
              const codeMatch = msg.match(/Enter code:\s*(\S+)/)
              if (urlMatch && codeMatch) {
                hasOAuthPending = true
                await sendMessage(relayBaseUrl, sessionId, {
                  type: 'oauth_device_code',
                  text: `Sign in to Microsoft for ${acc.email}`,
                  data: { url: urlMatch[1], code: codeMatch[1], email: acc.email }
                }).catch(() => {})
              }
            }
          }
        })
      )

      if (hasOAuthPending) {
        const pendingOAuths = _getPendingAuths()
        const deadline = Date.now() + 10 * 60 * 1000
        while (pendingOAuths.size > 0 && Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 2000))
        }
      }

      // Create unique userId
      const userId = `usr_${createHash('md5').update(credentials).digest('hex')}`
      userStore.saveCredentials(userId, { EMAIL_CREDENTIALS: credentials })

      const ourAuthCode = randomBytes(32).toString('hex')
      authCodes.set(ourAuthCode, {
        userId,
        challenge: pending.codeChallenge,
        challengeMethod: pending.codeChallengeMethod,
        clientId: pending.clientId,
        createdAt: Date.now()
      })

      pendingAuths.delete(stateKey)

      const clientRedirect = new URL(pending.redirectUri)
      clientRedirect.searchParams.set('code', ourAuthCode)
      if (pending.state) clientRedirect.searchParams.set('state', pending.state)

      await sendMessage(relayBaseUrl, sessionId, {
        type: 'complete',
        text: 'Credentials verified! Redirecting...',
        data: { redirect: clientRedirect.toString() }
      }).catch(() => {})
    } catch (_err: any) {
      pendingAuths.delete(stateKey)
    }
  }

  // OAuth Endpoints

  app.get('/authorize', authRateLimit, async (req, res) => {
    const { client_id, redirect_uri, state, code_challenge, code_challenge_method } = req.query as any
    if (!client_id || !redirect_uri || !code_challenge) {
      res.status(400).json({ error: 'missing_parameters' })
      return
    }

    const stateKey = randomBytes(32).toString('hex')
    try {
      const session = await createSession(relayBaseUrl, 'better-email-mcp', RELAY_SCHEMA)
      pendingAuths.set(stateKey, {
        clientId: client_id,
        redirectUri: redirect_uri,
        state,
        codeChallenge: code_challenge,
        codeChallengeMethod: code_challenge_method || 'S256',
        relaySession: session,
        createdAt: Date.now()
      })

      // Start the background poller
      pollRelayAndCompleteAuth(stateKey).catch(console.error)
      res.redirect(session.relayUrl)
    } catch (err: any) {
      res.status(500).json({ error: 'server_error', description: err.message })
    }
  })

  app.post('/token', authRateLimit, urlencodedParser, async (req, res) => {
    const { grant_type, code, code_verifier } = req.body
    if (grant_type !== 'authorization_code') {
      res.status(400).json({ error: 'unsupported_grant_type' })
      return
    }

    if (typeof code_verifier !== 'string') {
      res.status(400).json({ error: 'invalid_request', description: 'code_verifier must be a string' })
      return
    }

    const stored = authCodes.get(code)
    if (!stored) {
      res.status(400).json({ error: 'invalid_grant', description: 'Invalid or expired code' })
      return
    }

    // PKCE verification
    if (stored.challengeMethod === 'S256') {
      const digest = createHash('sha256').update(code_verifier).digest('base64url')
      const digestBuf = Buffer.from(digest)
      const challengeBuf = Buffer.from(stored.challenge)
      if (digestBuf.length !== challengeBuf.length || !timingSafeEqual(digestBuf, challengeBuf)) {
        res.status(400).json({ error: 'invalid_grant', description: 'PKCE mismatch' })
        return
      }
    } else {
      const verifierBuf = Buffer.from(code_verifier)
      const challengeBuf = Buffer.from(stored.challenge)
      if (verifierBuf.length !== challengeBuf.length || !timingSafeEqual(verifierBuf, challengeBuf)) {
        res.status(400).json({ error: 'invalid_grant', description: 'PKCE plain mismatch' })
        return
      }
    }

    authCodes.delete(code)

    try {
      const accessToken = await issuer.issueAccessToken(stored.userId)
      res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600
      })
    } catch (err: any) {
      res.status(500).json({ error: 'server_error', description: err.message })
    }
  })

  app.get('/.well-known/jwks.json', async (_req, res) => {
    res.json(issuer.getJwks())
  })

  app.get('/.well-known/oauth-authorization-server', (_req, res) => {
    res.json({
      issuer: publicUrl,
      authorization_endpoint: `${publicUrl}/authorize`,
      token_endpoint: `${publicUrl}/token`,
      jwks_uri: `${publicUrl}/.well-known/jwks.json`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256', 'plain'],
      token_endpoint_auth_methods_supported: ['none']
    })
  })

  // MCP Endpoints
  const transports = new Map<string, StreamableHTTPServerTransport>()
  const sessionOwners = new Map<string, string>()

  const checkBearerAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    const token = authHeader.substring(7)
    try {
      const payload = await issuer.verifyAccessToken(token)
      ;(req as any).userId = payload.sub
      next()
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' })
    }
  }

  app.post('/mcp', mcpRateLimit, jsonParser, checkBearerAuth, async (req, res) => {
    const userId = (req as any).userId
    const sessionId = req.headers['mcp-session-id'] as string | undefined

    if (sessionId && transports.has(sessionId)) {
      if (sessionOwners.get(sessionId) !== userId) {
        res.status(403).json({ error: 'Session belongs to a different user' })
        return
      }
      await transports.get(sessionId)!.handleRequest(req, res, req.body)
      return
    }

    if (!sessionId && isInitializeRequest(req.body)) {
      const creds = userStore.getCredentials(userId)
      if (!creds?.EMAIL_CREDENTIALS) {
        res.status(403).json({ error: 'No credentials found string' })
        return
      }

      const accounts = await parseCredentials(creds.EMAIL_CREDENTIALS)
      if (!accounts || accounts.length === 0) {
        res.status(403).json({ error: 'No valid accounts found' })
        return
      }

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID()
      })
      transport.onclose = () => {
        if (transport.sessionId) {
          transports.delete(transport.sessionId)
          sessionOwners.delete(transport.sessionId)
        }
      }

      const server = new Server({ name: 'better-email-mcp', version: '1.21.0' }, { capabilities: { tools: {} } })
      registerTools(server, accounts)

      await server.connect(transport)
      if (transport.sessionId) {
        transports.set(transport.sessionId, transport)
        sessionOwners.set(transport.sessionId, userId)
      }
      await transport.handleRequest(req, res, req.body)
      return
    }

    res.status(400).json({ error: 'Bad request' })
  })

  app.get('/mcp', mcpRateLimit, checkBearerAuth, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string
    if (sessionId && transports.has(sessionId)) {
      if (sessionOwners.get(sessionId) !== (req as any).userId) {
        res.status(403).json({ error: 'Session belongs to a different user' })
        return
      }
      await transports.get(sessionId)!.handleRequest(req, res)
    } else {
      res.status(400).json({ error: 'Invalid or missing session' })
    }
  })

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.listen(port, () => {
    console.info(`Email MCP OAuth HTTP server running on port ${port}`)
  })
}
