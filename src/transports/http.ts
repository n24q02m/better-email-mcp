/**
 * HTTP Transport — Remote mode with StreamableHTTPServerTransport.
 *
 * Simpler than Notion's OAuth-based flow: credentials come from relay setup
 * or stored encrypted on disk. No per-user OAuth needed — operator trust model.
 */

import { randomUUID } from 'node:crypto'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import { writeConfig } from '@n24q02m/mcp-relay-core'
import { createSession, pollForResult } from '@n24q02m/mcp-relay-core/relay'
import { resolveConfig } from '@n24q02m/mcp-relay-core/storage'
import express from 'express'
import { RELAY_SCHEMA } from '../relay-schema.js'
import { formatCredentials } from '../relay-setup.js'
import type { AccountConfig } from '../tools/helpers/config.js'
import { loadConfig } from '../tools/helpers/config.js'
import { ensureValidToken } from '../tools/helpers/oauth2.js'
import { registerTools } from '../tools/registry.js'
import { deleteCredentials, loadCredentials, storeCredentials } from './credential-store.js'

const SERVER_NAME = 'better-email-mcp'
const DEFAULT_RELAY_URL = 'https://better-email-mcp.n24q02m.com'
const REQUIRED_FIELDS = ['email', 'password']

interface HttpConfig {
  port: number
}

function loadHttpConfig(): HttpConfig {
  return {
    port: parseInt(process.env.PORT ?? '8080', 10)
  }
}

function getVersion(): string {
  try {
    // Dynamic import not needed — version is only for display
    return process.env.npm_package_version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

/**
 * Resolve email credentials for HTTP mode.
 *
 * Priority:
 * 1. EMAIL_CREDENTIALS env var (explicit config)
 * 2. Encrypted credential store (~/.better-email-mcp/credentials.enc)
 * 3. mcp-relay-core config file (~/.config/mcp/config.enc)
 * 4. Relay setup (browser-based form)
 */
async function resolveCredentials(): Promise<string> {
  // 1. Env var
  if (process.env.EMAIL_CREDENTIALS) {
    return process.env.EMAIL_CREDENTIALS
  }

  // 2. Encrypted credential store
  const stored = await loadCredentials()
  if (stored) {
    const formatted = formatCredentials(stored)
    process.env.EMAIL_CREDENTIALS = formatted
    return formatted
  }

  // 3. mcp-relay-core config file
  const result = await resolveConfig(SERVER_NAME, REQUIRED_FIELDS)
  if (result.config !== null) {
    console.error(`Email config loaded from ${result.source}`)
    // Also save to encrypted store for faster future loads
    await storeCredentials(result.config)
    const formatted = formatCredentials(result.config)
    process.env.EMAIL_CREDENTIALS = formatted
    return formatted
  }

  // 4. Relay setup
  console.error('No email credentials found. Starting relay setup...')
  const relayUrl = process.env.RELAY_URL || DEFAULT_RELAY_URL

  let session: Awaited<ReturnType<typeof createSession>>
  try {
    session = await createSession(relayUrl, SERVER_NAME, RELAY_SCHEMA)
  } catch {
    throw new Error(
      `Cannot reach relay server at ${relayUrl}. Set EMAIL_CREDENTIALS manually.\nFormat: email1:password1,email2:password2`
    )
  }

  console.error(`\nSetup required. Open this URL to configure:\n${session.relayUrl}\n`)

  let config: Record<string, string>
  try {
    config = await pollForResult(relayUrl, session)
  } catch {
    throw new Error('Relay setup timed out or session expired')
  }

  // Save to both stores
  await writeConfig(SERVER_NAME, config)
  await storeCredentials(config)
  console.error('Email config saved successfully')

  const formatted = formatCredentials(config)
  process.env.EMAIL_CREDENTIALS = formatted
  return formatted
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

export async function startHttp(): Promise<void> {
  const config = loadHttpConfig()

  // Resolve credentials
  await resolveCredentials()

  // Load accounts from resolved credentials
  const accounts = await loadConfig()

  if (accounts.length === 0) {
    console.error('Warning: No email accounts configured')
    console.error('Set EMAIL_CREDENTIALS to enable email tools')
  } else {
    console.error(`Loaded ${accounts.length} email account(s)`)
  }

  // Proactive OAuth2 auth for Outlook accounts
  await Promise.all(
    accounts.map(async (account) => {
      if (account.authType === 'oauth2' && !account.oauth2) {
        try {
          await ensureValidToken(account)
        } catch (err: any) {
          console.error(err.message)
        }
      }
    })
  )

  const app = express()
  app.set('trust proxy', 2)
  app.disable('x-powered-by')

  const jsonParser = express.json()
  const transports: Map<string, StreamableHTTPServerTransport> = new Map()

  // MCP endpoint — POST (new session or existing)
  app.post('/mcp', jsonParser, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined

    // Existing session
    if (sessionId && transports.has(sessionId)) {
      await transports.get(sessionId)!.handleRequest(req, res, req.body)
      return
    }

    // New session — must be initialize request
    if (!sessionId && isInitializeRequest(req.body)) {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          transports.set(id, transport)
        }
      })

      transport.onclose = () => {
        if (transport.sessionId) {
          transports.delete(transport.sessionId)
        }
      }

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

  // MCP endpoint — GET (SSE streaming for existing session)
  app.get('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string
    if (sessionId && transports.has(sessionId)) {
      await transports.get(sessionId)!.handleRequest(req, res)
    } else {
      res.status(400).json({ error: 'Invalid or missing session' })
    }
  })

  // MCP endpoint — DELETE (close session)
  app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string
    if (sessionId && transports.has(sessionId)) {
      await transports.get(sessionId)!.handleRequest(req, res)
    } else {
      res.status(400).json({ error: 'Invalid or missing session' })
    }
  })

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      mode: 'http',
      accounts: accounts.length,
      timestamp: new Date().toISOString()
    })
  })

  // Credential management — reset stored credentials
  app.post('/reset-credentials', async (_req, res) => {
    try {
      await deleteCredentials()
      res.json({ status: 'ok', message: 'Credentials deleted. Restart server to reconfigure.' })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.listen(config.port, '0.0.0.0', () => {
    console.info(`Email MCP HTTP server listening on port ${config.port}`)
    console.info(`Accounts: ${accounts.map((a) => a.email).join(', ') || 'none'}`)
  })
}
