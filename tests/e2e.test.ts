/**
 * Consolidated E2E Tests for better-email-mcp
 *
 * Spawns the actual MCP server via stdio and communicates using JSON-RPC
 * through the official MCP SDK client. Covers ALL 5 tools and ALL 15 actions.
 *
 * Four setup modes controlled by E2E_SETUP env var:
 *   - 'env'    (default) : node bin/cli.mjs with EMAIL_CREDENTIALS env var
 *   - 'plugin' :           npx -y @n24q02m/better-email-mcp with EMAIL_CREDENTIALS
 *   - 'relay'  :           node bin/cli.mjs WITHOUT env, relay browser config
 *   - 'http'   :           HTTP server with OAuth 2.1 + DCR + relay credential form
 *
 * Protocol + help tests run without credentials.
 * Email operation tests require EMAIL_CREDENTIALS and skip if not set.
 *
 * Usage:
 *   EMAIL_CREDENTIALS=user@gmail.com:app-pass bun run vitest run tests/e2e.test.ts
 *   E2E_SETUP=plugin EMAIL_CREDENTIALS=... bun run vitest run tests/e2e.test.ts
 *   E2E_SETUP=relay E2E_BROWSER=chrome bun run vitest run tests/e2e.test.ts
 *   E2E_SETUP=http E2E_BROWSER=chrome bun run vitest run tests/e2e.test.ts
 */

import { createHash, randomBytes } from 'node:crypto'
import { execSync, spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import type { ChildProcess } from 'node:child_process'
import type { Server as HttpServer } from 'node:http'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/** Resolve npx command for plugin mode (Windows .mjs bin workaround) */
function pluginCommand(pkg: string): { command: string; args: string[] } {
  if (process.platform === 'win32') {
    const binName = pkg.split('/').pop()!
    try { execSync(`npx -y ${pkg} --help`, { stdio: 'ignore', timeout: 30_000 }) } catch { /* install */ }
    const npxCache = (process.env.LOCALAPPDATA ?? '') + '/npm-cache/_npx'
    const cacheHit = execSync(`find "${npxCache}" -path "*/${binName}/bin/cli.mjs" -print -quit`, { encoding: 'utf-8' }).trim()
    if (cacheHit) return { command: process.execPath, args: [cacheHit] }
  }
  return { command: 'npx', args: ['-y', pkg] }
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const E2E_SETUP = (process.env.E2E_SETUP ?? 'env') as 'env' | 'plugin' | 'relay' | 'http'
const E2E_BROWSER = process.env.E2E_BROWSER ?? 'chrome'
const EMAIL_CREDS = process.env.EMAIL_CREDENTIALS ?? ''
/** Credentials available via env var, relay mode, or http mode (user provides via relay form) */
const HAS_CREDS = !!EMAIL_CREDS || E2E_SETUP === 'relay' || E2E_SETUP === 'http'
// Mutable: set from env var initially, updated by probe if relay/saved tokens provide it
let TEST_ACCOUNT = EMAIL_CREDS.split(',')[0]?.split(':')[0] ?? ''

const EXPECTED_TOOLS = ['messages', 'folders', 'attachments', 'send', 'help'] as const
const EMAIL_DEPENDENT_TOOLS = ['messages', 'folders', 'attachments', 'send'] as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract JSON object from the MCP tool result text (server wraps with header/footer) */
function parseResult(result: any): any {
  const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`No JSON in response: ${text}`)
  return JSON.parse(jsonMatch[0])
}

/** Wait for email delivery propagation */
function waitForDelivery(ms = 5000): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Generate unique test subject to avoid collision between runs */
function testSubject(label = ''): string {
  const suffix = label ? `-${label}` : ''
  return `[MCP-TEST-${Date.now()}${suffix}]`
}

// ---------------------------------------------------------------------------
// Transport factory (stdio modes only -- http mode handled separately in beforeAll)
// ---------------------------------------------------------------------------

function createStdioTransport(): StdioClientTransport {
  switch (E2E_SETUP) {
    case 'plugin':
      return new StdioClientTransport({
        ...pluginCommand('@n24q02m/better-email-mcp'),
        env: {
          ...process.env,
          EMAIL_CREDENTIALS: EMAIL_CREDS,
          NODE_ENV: 'test'
        },
        stderr: 'pipe'
      })

    case 'relay':
      // Relay mode: start WITHOUT EMAIL_CREDENTIALS
      return new StdioClientTransport({
        command: 'node',
        args: ['bin/cli.mjs'],
        env: {
          PATH: process.env.PATH ?? '',
          HOME: process.env.HOME ?? process.env.USERPROFILE ?? '',
          APPDATA: process.env.APPDATA ?? '',
          NODE_ENV: 'test'
          // Intentionally NO EMAIL_CREDENTIALS
        },
        stderr: 'pipe'
      })

    case 'env':
    default:
      return new StdioClientTransport({
        command: 'node',
        args: ['bin/cli.mjs'],
        env: {
          ...process.env,
          EMAIL_CREDENTIALS: EMAIL_CREDS,
          NODE_ENV: 'test'
        },
        stderr: 'pipe'
      })
  }
}

// ---------------------------------------------------------------------------
// HTTP mode constants
// ---------------------------------------------------------------------------

const HTTP_E2E_PORT = 18080
const HTTP_E2E_URL = `http://127.0.0.1:${HTTP_E2E_PORT}`
const HTTP_E2E_CALLBACK_PORT = 19877
const HTTP_E2E_REDIRECT_URI = `http://localhost:${HTTP_E2E_CALLBACK_PORT}/callback`
const HTTP_E2E_DCR_SECRET = 'e2e-http-mode-secret-that-is-at-least-32-bytes-long!!'

// ---------------------------------------------------------------------------
// PKCE helpers for HTTP mode
// ---------------------------------------------------------------------------

function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url')
}

function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

// ---------------------------------------------------------------------------
// HTTP mode: OAuth flow to obtain a bearer token
// ---------------------------------------------------------------------------

/**
 * Start a local HTTP callback server that captures the authorization code
 * from the OAuth redirect. Returns a promise that resolves with the code.
 */
function startCallbackServer(): { server: HttpServer; codePromise: Promise<string> } {
  let resolveCode: (code: string) => void
  let rejectCode: (err: Error) => void
  const codePromise = new Promise<string>((resolve, reject) => {
    resolveCode = resolve
    rejectCode = reject
  })

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${HTTP_E2E_CALLBACK_PORT}`)
    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code')
      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<html><body><h1>Authorization successful</h1><p>You can close this tab.</p></body></html>')
        resolveCode(code)
      } else {
        const error = url.searchParams.get('error') ?? 'no code received'
        res.writeHead(400, { 'Content-Type': 'text/plain' })
        res.end(`Error: ${error}`)
        rejectCode(new Error(`OAuth callback error: ${error}`))
      }
    } else {
      res.writeHead(404)
      res.end('Not found')
    }
  })

  server.listen(HTTP_E2E_CALLBACK_PORT)
  return { server, codePromise }
}

/**
 * Perform the full OAuth 2.1 + DCR flow against the local HTTP server:
 *   1. DCR register -> client_id / client_secret
 *   2. Build PKCE authorize URL
 *   3. Follow redirect to get relay form URL
 *   4. Open browser for user to enter email credentials
 *   5. Start callback server to capture auth code
 *   6. Exchange code for bearer token
 */
async function performHttpOAuthFlow(): Promise<{
  accessToken: string
  clientId: string
  clientSecret: string
}> {
  // 1. DCR registration
  const dcrRes = await fetch(`${HTTP_E2E_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      redirect_uris: [HTTP_E2E_REDIRECT_URI],
      client_name: 'e2e-http-mode-test',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_post'
    })
  })
  if (!dcrRes.ok) throw new Error(`DCR failed: ${dcrRes.status} ${await dcrRes.text()}`)
  const dcrBody = await dcrRes.json()
  const clientId = dcrBody.client_id as string
  const clientSecret = dcrBody.client_secret as string

  // 2. Build PKCE authorize URL
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)
  const state = randomBytes(16).toString('hex')

  const authorizeUrl = new URL(`${HTTP_E2E_URL}/authorize`)
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('client_id', clientId)
  authorizeUrl.searchParams.set('redirect_uri', HTTP_E2E_REDIRECT_URI)
  authorizeUrl.searchParams.set('code_challenge', codeChallenge)
  authorizeUrl.searchParams.set('code_challenge_method', 'S256')
  authorizeUrl.searchParams.set('state', state)

  // 3. Follow redirect to get relay form URL
  const authRes = await fetch(authorizeUrl.toString(), { redirect: 'manual' })
  const location = authRes.headers.get('location') ?? ''

  // Determine the relay form URL (may be relative or absolute)
  let relayFormUrl: string
  if (location.startsWith('http')) {
    relayFormUrl = location
  } else if (location) {
    relayFormUrl = `${HTTP_E2E_URL}${location}`
  } else {
    // Some servers render the form inline at /authorize
    relayFormUrl = authorizeUrl.toString()
  }

  // 4. Start callback server and open browser for credential entry
  const { server: callbackServer, codePromise } = startCallbackServer()

  console.error(`\nHTTP mode relay form URL: ${relayFormUrl}`)
  console.error('Opening browser -- please enter EMAIL_CREDENTIALS in the relay form...\n')
  openBrowser(relayFormUrl)

  // 5. Wait for auth code from callback
  let authCode: string
  try {
    authCode = await Promise.race([
      codePromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('OAuth callback timeout: no code received within 5 minutes')), 300_000)
      )
    ])
  } finally {
    callbackServer.close()
  }

  // 6. Exchange auth code for access token
  const tokenRes = await fetch(`${HTTP_E2E_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: HTTP_E2E_REDIRECT_URI,
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: codeVerifier
    })
  })
  if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`)
  const tokenBody = await tokenRes.json()
  const accessToken = tokenBody.access_token as string
  if (!accessToken) throw new Error(`No access_token in token response: ${JSON.stringify(tokenBody)}`)

  console.error('HTTP mode: OAuth flow complete, bearer token acquired')
  return { accessToken, clientId, clientSecret }
}

/**
 * Open a URL in the browser for manual credential entry safely.
 * Used by relay mode (stdio relay form) and http mode (OAuth relay form).
 * Uses spawnSync with argument arrays to prevent command injection.
 */
function openBrowser(url: string): void {
  let safeUrl: string
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return
    }
    safeUrl = parsed.href
  } catch {
    return
  }

  const browser = E2E_BROWSER || 'default'

  if (process.platform === 'win32') {
    let cmd = 'cmd.exe'
    let args = ['/c', 'start', '""', safeUrl]

    if (browser === 'chrome') {
      cmd = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      args = [safeUrl]
    } else if (browser === 'firefox') {
      cmd = 'C:\\Program Files\\Mozilla Firefox\\firefox.exe'
      args = [safeUrl]
    }

    try {
      spawnSync(cmd, args, { stdio: 'ignore' })
    } catch {
      console.error(`Failed to open browser with: ${cmd}`)
      console.error(`Please open manually: ${url}`)
    }
    return
  }

  if (process.platform === 'darwin') {
    const args = browser === 'chrome' ? ['-a', 'Google Chrome'] : browser === 'firefox' ? ['-a', 'Firefox'] : []
    args.push(safeUrl)
    try {
      spawnSync('open', args, { stdio: 'ignore' })
    } catch {
      console.error('Failed to open browser on macOS')
      console.error(`Please open manually: ${url}`)
    }
    return
  }

  const cmd = browser === 'chrome' ? 'google-chrome' : browser === 'firefox' ? 'firefox' : 'xdg-open'
  try {
    spawnSync(cmd, [safeUrl], { stdio: 'ignore' })
  } catch {
    console.error(`Failed to open browser with: ${cmd}`)
    console.error(`Please open manually: ${url}`)
  }
}

/**
 * For relay mode: wait until the server has credentials by polling folders.list.
 * When the "No email accounts configured" error stops appearing, config is ready.
 */
async function waitForRelayConfig(client: Client, timeoutMs = 120_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const result = await client.callTool({
        name: 'folders',
        arguments: { action: 'list' }
      })
      const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? ''
      if (!text.includes('No email accounts configured')) {
        return // Config is ready
      }
    } catch {
      // Server not ready yet, keep polling
    }
    await new Promise((r) => setTimeout(r, 3000))
  }
  throw new Error('Relay config timeout: server did not receive credentials within 2 minutes')
}

// ---------------------------------------------------------------------------
// Single shared client for the entire test suite
// ---------------------------------------------------------------------------

let client: Client
let transport: StdioClientTransport | StreamableHTTPClientTransport
let httpServerProcess: ChildProcess | undefined

// Track all test email UIDs for cleanup in afterAll
const testUids: number[] = []

beforeAll(async () => {
  client = new Client({ name: 'e2e-test', version: '1.0.0' })

  if (E2E_SETUP === 'http') {
    // --- HTTP mode: spawn HTTP server, OAuth flow, StreamableHTTPClientTransport ---
    const { spawn } = await import('node:child_process')
    httpServerProcess = spawn('node', ['bin/cli.mjs'], {
      env: {
        ...process.env,
        TRANSPORT_MODE: 'http',
        PUBLIC_URL: HTTP_E2E_URL,
        DCR_SERVER_SECRET: HTTP_E2E_DCR_SECRET,
        PORT: String(HTTP_E2E_PORT),
        NODE_ENV: 'test'
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: process.cwd()
    })

    // Capture stderr for debugging
    httpServerProcess.stderr?.on('data', (chunk: Buffer) => {
      const line = chunk.toString().trim()
      if (line) console.error(`[http-server] ${line}`)
    })

    // Wait for /health to be ready
    const deadline = Date.now() + 15_000
    let serverReady = false
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${HTTP_E2E_URL}/health`)
        if (res.ok) {
          serverReady = true
          break
        }
      } catch {
        /* not ready yet */
      }
      await new Promise((r) => setTimeout(r, 500))
    }
    if (!serverReady) throw new Error('HTTP server did not become healthy within 15s')

    // Perform full OAuth 2.1 + DCR + relay credential flow
    const { accessToken } = await performHttpOAuthFlow()

    // Create StreamableHTTPClientTransport with bearer token
    transport = new StreamableHTTPClientTransport(
      new URL(`${HTTP_E2E_URL}/mcp`),
      {
        requestInit: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      }
    )

    await client.connect(transport)
    console.error('HTTP mode: MCP client connected via StreamableHTTPClientTransport')
  } else if (E2E_SETUP === 'relay') {
    // --- Relay mode: stdio without EMAIL_CREDENTIALS ---
    transport = createStdioTransport()

    // transport.stderr is a PassThrough available immediately (before connect)
    const stderrChunks: string[] = []
    const stderrStream = (transport as StdioClientTransport).stderr
    if (stderrStream) {
      stderrStream.on('data', (chunk: Buffer) => {
        stderrChunks.push(chunk.toString())
      })
    }

    // connect() BLOCKS until ensureConfig() completes (relay setup or degraded mode).
    // Server prints relay URL BEFORE blocking on pollForResult().
    // Start connect in background, watch stderr for URL.
    const connectPromise = client.connect(transport)

    // Wait for relay URL in stderr
    const urlDeadline = Date.now() + 30_000
    let relayUrl = ''
    while (Date.now() < urlDeadline && !relayUrl) {
      const combined = stderrChunks.join('')
      const match = combined.match(/(https?:\/\/[^\s]+\/setup\?s=[^\s]+)/)
      if (match) {
        relayUrl = match[0]
        break
      }
      // Check for degraded mode or saved tokens (no relay needed)
      if (combined.includes('Cannot reach relay server') || combined.includes('No email accounts configured')
        || combined.includes('Found saved OAuth2 tokens') || combined.includes('config loaded from')) {
        break
      }
      await new Promise((r) => setTimeout(r, 500))
    }

    if (relayUrl) {
      console.error(`\nRelay URL found: ${relayUrl}`)
      console.error('Opening browser -- please enter EMAIL_CREDENTIALS in the relay page...\n')
      openBrowser(relayUrl)

      // connect() resolves once user submits credentials and server unblocks
      await connectPromise
      console.error('Relay config received -- server connected, proceeding with tests')
    } else {
      console.error('No relay URL found -- server started in degraded mode (no EMAIL_CREDENTIALS)')
      await connectPromise
    }
  } else {
    // --- env / plugin mode: stdio with EMAIL_CREDENTIALS ---
    transport = createStdioTransport()
    await client.connect(transport)
  }

  // Probe: if TEST_ACCOUNT is empty (relay/http/saved tokens), detect from folders.list
  if (!TEST_ACCOUNT && HAS_CREDS) {
    try {
      const probe = await client.callTool({ name: 'folders', arguments: { action: 'list' } })
      const text = (probe.content as Array<{ type: string; text: string }>)[0]?.text ?? ''
      const emailMatch = text.match(/[\w.+-]+@[\w.-]+\.\w+/)
      if (emailMatch) {
        TEST_ACCOUNT = emailMatch[0]
        console.error(`Detected account from server: ${TEST_ACCOUNT}`)
      }
    } catch {
      // Probe failed -- TEST_ACCOUNT remains empty
    }
  }
}, 180_000) // 3 min for relay/http mode with manual browser interaction

afterAll(async () => {
  // Best-effort cleanup: trash all test emails
  if (testUids.length > 0 && TEST_ACCOUNT) {
    try {
      await client.callTool({
        name: 'messages',
        arguments: {
          action: 'trash',
          account: TEST_ACCOUNT,
          uids: testUids
        }
      })
    } catch {
      // Best-effort
    }
  }
  await transport.close()

  // Kill HTTP server process if running
  if (httpServerProcess) {
    httpServerProcess.kill()
    httpServerProcess = undefined
  }
})

// ===========================================================================
// 1. Server initialization (no credentials needed)
// ===========================================================================

describe('Server initialization', () => {
  it('should connect and report server info', () => {
    const info = client.getServerVersion()
    expect(info).toBeDefined()
    expect(info?.name).toBe('@n24q02m/better-email-mcp')
    expect(info?.version).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('should report tools capability', () => {
    const caps = client.getServerCapabilities()
    expect(caps).toBeDefined()
    expect(caps?.tools).toBeDefined()
  })

  it('should report resources capability', () => {
    const caps = client.getServerCapabilities()
    expect(caps?.resources).toBeDefined()
  })
})

// ===========================================================================
// 2. tools/list (no credentials needed)
// ===========================================================================

describe('tools/list', () => {
  it('should return all 5 tools', async () => {
    const result = await client.listTools()
    const names = result.tools.map((t) => t.name)
    expect(names).toHaveLength(5)
    for (const name of EXPECTED_TOOLS) {
      expect(names).toContain(name)
    }
  })

  it('should have valid inputSchema for each tool', async () => {
    const result = await client.listTools()
    for (const tool of result.tools) {
      expect(tool.inputSchema).toBeDefined()
      expect(tool.inputSchema.type).toBe('object')
      expect(tool.description).toBeTruthy()
    }
  })

  it('should have annotations on each tool', async () => {
    const result = await client.listTools()
    for (const tool of result.tools) {
      expect(tool.annotations).toBeDefined()
      expect(tool.annotations?.title).toBeTruthy()
    }
  })
})

// ===========================================================================
// 3. help tool (no credentials needed)
// ===========================================================================

describe('help', () => {
  for (const toolName of EXPECTED_TOOLS) {
    it(`should return documentation for ${toolName}`, async () => {
      const result = await client.callTool({
        name: 'help',
        arguments: { tool_name: toolName }
      })
      expect(result.isError).toBeFalsy()
      const text = (result.content as Array<{ type: string; text: string }>)[0]?.text
      expect(text).toBeTruthy()
      expect(text).toContain(toolName)
    })
  }

  it('should return error for invalid tool name', async () => {
    const result = await client.callTool({
      name: 'help',
      arguments: { tool_name: 'nonexistent' }
    })
    expect(result.isError).toBe(true)
    const text = (result.content as Array<{ type: string; text: string }>)[0]?.text
    expect(text).toContain('Invalid tool name')
  })
})

// ===========================================================================
// 4. folders (requires EMAIL_CREDENTIALS)
// ===========================================================================

describe.skipIf(!HAS_CREDS)('folders', () => {
  it('folders.list -- should list folders and include INBOX', async () => {
    const result = await client.callTool({
      name: 'folders',
      arguments: { action: 'list', account: TEST_ACCOUNT }
    })

    expect(result.isError).toBeFalsy()
    const data = parseResult(result)
    expect(data.action).toBe('list')
    expect(data.total_accounts).toBeGreaterThanOrEqual(1)

    const accountFolders = data.accounts[0]
    expect(accountFolders.account_email).toBe(TEST_ACCOUNT)
    expect(accountFolders.folders.length).toBeGreaterThan(0)

    const folderPaths = accountFolders.folders.map((f: any) => f.path)
    expect(folderPaths).toContain('INBOX')
  }, 30_000)
})

// ===========================================================================
// 5. messages -- send + lifecycle (requires EMAIL_CREDENTIALS)
// ===========================================================================

describe.skipIf(!HAS_CREDS)('messages -- send + lifecycle', () => {
  const LIFECYCLE_SUBJECT = testSubject('LIFECYCLE')
  let sentUid: number

  // 5.1 send.new
  it('send.new -- send email to self', async () => {
    const result = await client.callTool({
      name: 'send',
      arguments: {
        action: 'new',
        account: TEST_ACCOUNT,
        to: TEST_ACCOUNT,
        subject: LIFECYCLE_SUBJECT,
        body: `Test body for ${LIFECYCLE_SUBJECT}`
      }
    })

    expect(result.isError).toBeFalsy()
    const data = parseResult(result)
    expect(data.action).toBe('new')
    expect(data.success).toBe(true)
    expect(data.from).toBe(TEST_ACCOUNT)
    expect(data.to).toBe(TEST_ACCOUNT)
    expect(data.subject).toBe(LIFECYCLE_SUBJECT)
    expect(data.message_id).toBeTruthy()
  }, 30_000)

  // 5.2 messages.search
  it('messages.search -- find the sent email by subject', async () => {
    await waitForDelivery(5000)

    const result = await client.callTool({
      name: 'messages',
      arguments: {
        action: 'search',
        account: TEST_ACCOUNT,
        query: `SUBJECT "${LIFECYCLE_SUBJECT}"`,
        folder: 'INBOX',
        limit: 5
      }
    })

    expect(result.isError).toBeFalsy()
    const data = parseResult(result)
    expect(data.action).toBe('search')
    expect(data.total).toBeGreaterThanOrEqual(1)

    const found = data.messages.find((m: any) => m.subject?.includes('[MCP-TEST-'))
    expect(found).toBeDefined()
    sentUid = found.uid
    testUids.push(sentUid)
  }, 60_000)

  // 5.3 messages.read
  it('messages.read -- read the email and verify body', async () => {
    expect(sentUid).toBeDefined()

    const result = await client.callTool({
      name: 'messages',
      arguments: {
        action: 'read',
        account: TEST_ACCOUNT,
        uid: sentUid
      }
    })

    expect(result.isError).toBeFalsy()
    const data = parseResult(result)
    expect(data.action).toBe('read')
    expect(data.subject).toContain('[MCP-TEST-')
    expect(data.body_text).toContain('Test body for')
  }, 30_000)

  // 5.4 messages.mark_read
  it('messages.mark_read -- mark as read', async () => {
    expect(sentUid).toBeDefined()

    const result = await client.callTool({
      name: 'messages',
      arguments: {
        action: 'mark_read',
        account: TEST_ACCOUNT,
        uid: sentUid
      }
    })

    expect(result.isError).toBeFalsy()
    const data = parseResult(result)
    expect(data.action).toBe('mark_read')
    expect(data.account).toBe(TEST_ACCOUNT)
  }, 30_000)

  // 5.5 messages.mark_unread
  it('messages.mark_unread -- mark as unread', async () => {
    expect(sentUid).toBeDefined()

    const result = await client.callTool({
      name: 'messages',
      arguments: {
        action: 'mark_unread',
        account: TEST_ACCOUNT,
        uid: sentUid
      }
    })

    expect(result.isError).toBeFalsy()
    const data = parseResult(result)
    expect(data.action).toBe('mark_unread')
    expect(data.account).toBe(TEST_ACCOUNT)
  }, 30_000)

  // 5.6 messages.flag
  it('messages.flag -- flag the message', async () => {
    expect(sentUid).toBeDefined()

    const result = await client.callTool({
      name: 'messages',
      arguments: {
        action: 'flag',
        account: TEST_ACCOUNT,
        uid: sentUid
      }
    })

    expect(result.isError).toBeFalsy()
    const data = parseResult(result)
    expect(data.action).toBe('flag')
    expect(data.account).toBe(TEST_ACCOUNT)
  }, 30_000)

  // 5.7 messages.unflag
  it('messages.unflag -- unflag the message', async () => {
    expect(sentUid).toBeDefined()

    const result = await client.callTool({
      name: 'messages',
      arguments: {
        action: 'unflag',
        account: TEST_ACCOUNT,
        uid: sentUid
      }
    })

    expect(result.isError).toBeFalsy()
    const data = parseResult(result)
    expect(data.action).toBe('unflag')
    expect(data.account).toBe(TEST_ACCOUNT)
  }, 30_000)

  // 5.8 messages.move
  it('messages.move -- move to a different folder and verify', async () => {
    expect(sentUid).toBeDefined()

    // Detect available folders to pick a valid destination
    const foldersResult = await client.callTool({
      name: 'folders',
      arguments: { action: 'list', account: TEST_ACCOUNT }
    })
    const foldersData = parseResult(foldersResult)
    const folderPaths: string[] = (foldersData.accounts?.[0]?.folders ?? []).map((f: any) => f.path)

    // Pick destination: prefer Drafts (works on all providers)
    const destination = folderPaths.find((f: string) => /drafts/i.test(f)) ?? folderPaths.find((f: string) => f !== 'INBOX') ?? 'Drafts'

    const moveResult = await client.callTool({
      name: 'messages',
      arguments: {
        action: 'move',
        account: TEST_ACCOUNT,
        uid: sentUid,
        folder: 'INBOX',
        destination
      }
    })

    expect(moveResult.isError).toBeFalsy()
    const moveData = parseResult(moveResult)
    expect(moveData.action).toBe('move')
    expect(moveData.from_folder).toBe('INBOX')
    expect(moveData.account).toBe(TEST_ACCOUNT)

    // After move, UID may change. Remove old UID from cleanup.
    const idx = testUids.indexOf(sentUid)
    if (idx >= 0) testUids.splice(idx, 1)

    // Search in destination folder for cleanup
    await waitForDelivery(2000)
    const searchResult = await client.callTool({
      name: 'messages',
      arguments: {
        action: 'search',
        account: TEST_ACCOUNT,
        query: `SUBJECT "${LIFECYCLE_SUBJECT}"`,
        folder: destination,
        limit: 5
      }
    })
    if (!searchResult.isError) {
      const searchData = parseResult(searchResult)
      const found = searchData.messages?.find((m: any) => m.subject?.includes('[MCP-TEST-'))
      if (found) {
        sentUid = found.uid
        await client.callTool({
          name: 'messages',
          arguments: { action: 'trash', account: TEST_ACCOUNT, uid: sentUid, folder: destination }
        })
      }
    }
  }, 60_000)

  // 5.9 messages.archive
  it('messages.archive -- archive a message', async () => {
    const archiveSubject = testSubject('ARCHIVE')

    // Send a fresh email
    const sendResult = await client.callTool({
      name: 'send',
      arguments: {
        action: 'new',
        account: TEST_ACCOUNT,
        to: TEST_ACCOUNT,
        subject: archiveSubject,
        body: 'Email for archive test'
      }
    })
    expect(sendResult.isError).toBeFalsy()

    await waitForDelivery(5000)

    // Find the email
    const searchResult = await client.callTool({
      name: 'messages',
      arguments: {
        action: 'search',
        account: TEST_ACCOUNT,
        query: `SUBJECT "${archiveSubject}"`,
        folder: 'INBOX',
        limit: 5
      }
    })
    const searchData = parseResult(searchResult)
    const found = searchData.messages.find((m: any) => m.subject?.includes('MCP-TEST-'))
    expect(found).toBeDefined()

    const archiveUid = found.uid

    // Archive it
    const archiveResult = await client.callTool({
      name: 'messages',
      arguments: {
        action: 'archive',
        account: TEST_ACCOUNT,
        uid: archiveUid
      }
    })

    expect(archiveResult.isError).toBeFalsy()
    const archiveData = parseResult(archiveResult)
    expect(archiveData.action).toBe('archive')
    expect(archiveData.account).toBe(TEST_ACCOUNT)
    expect(archiveData.from_folder).toBe('INBOX')
    // archive_folder varies by provider ([Gmail]/All Mail, Archive, etc.)
    expect(archiveData.archive_folder).toBeTruthy()

    // Cleanup: find in archive folder and trash
    await waitForDelivery(2000)
    try {
      const cleanupSearch = await client.callTool({
        name: 'messages',
        arguments: {
          action: 'search',
          account: TEST_ACCOUNT,
          query: `SUBJECT "${archiveSubject}"`,
          folder: archiveData.archive_folder,
          limit: 5
        }
      })
      const cleanupData = parseResult(cleanupSearch)
      for (const msg of cleanupData.messages) {
        if (msg.subject?.includes('MCP-TEST-')) {
          await client.callTool({
            name: 'messages',
            arguments: {
              action: 'trash',
              account: TEST_ACCOUNT,
              uid: msg.uid,
              folder: archiveData.archive_folder
            }
          })
        }
      }
    } catch {
      // Best-effort cleanup
    }
  }, 60_000)

  // 5.10 messages.trash
  it('messages.trash -- send a fresh email and trash it', async () => {
    const trashSubject = testSubject('TRASH')

    await client.callTool({
      name: 'send',
      arguments: {
        action: 'new',
        account: TEST_ACCOUNT,
        to: TEST_ACCOUNT,
        subject: trashSubject,
        body: 'Email to be trashed'
      }
    })

    await waitForDelivery(5000)

    const searchResult = await client.callTool({
      name: 'messages',
      arguments: {
        action: 'search',
        account: TEST_ACCOUNT,
        query: `SUBJECT "${trashSubject}"`,
        folder: 'INBOX',
        limit: 5
      }
    })
    const searchData = parseResult(searchResult)
    const trashMsg = searchData.messages.find((m: any) => m.subject?.includes('MCP-TEST-'))
    expect(trashMsg).toBeDefined()

    const result = await client.callTool({
      name: 'messages',
      arguments: {
        action: 'trash',
        account: TEST_ACCOUNT,
        uid: trashMsg.uid
      }
    })

    expect(result.isError).toBeFalsy()
    const data = parseResult(result)
    expect(data.action).toBe('trash')
    expect(data.account).toBe(TEST_ACCOUNT)
  }, 60_000)
})

// ===========================================================================
// 6. send.reply (requires EMAIL_CREDENTIALS)
// ===========================================================================

describe.skipIf(!HAS_CREDS)('send.reply', () => {
  const replySubject = testSubject('REPLY')
  let originalUid: number

  it('should send original, find it, reply, and verify Re: prefix', async () => {
    // Step 1: Send original
    const sendResult = await client.callTool({
      name: 'send',
      arguments: {
        action: 'new',
        account: TEST_ACCOUNT,
        to: TEST_ACCOUNT,
        subject: replySubject,
        body: 'Original message for reply test'
      }
    })
    expect(sendResult.isError).toBeFalsy()

    await waitForDelivery(5000)

    // Step 2: Find the email
    const searchResult = await client.callTool({
      name: 'messages',
      arguments: {
        action: 'search',
        account: TEST_ACCOUNT,
        query: `SUBJECT "${replySubject}"`,
        folder: 'INBOX',
        limit: 5
      }
    })
    const searchData = parseResult(searchResult)
    const found = searchData.messages.find((m: any) => m.subject?.includes('MCP-TEST-'))
    expect(found).toBeDefined()
    originalUid = found.uid
    testUids.push(originalUid)

    // Step 3: Reply to it
    const replyResult = await client.callTool({
      name: 'send',
      arguments: {
        action: 'reply',
        account: TEST_ACCOUNT,
        uid: originalUid,
        body: 'This is a reply to the test email'
      }
    })
    expect(replyResult.isError).toBeFalsy()
    const replyData = parseResult(replyResult)
    expect(replyData.action).toBe('reply')
    expect(replyData.success).toBe(true)
    expect(replyData.subject).toContain('Re:')
    expect(replyData.in_reply_to).toBeTruthy()

    // Cleanup: collect reply UIDs
    await waitForDelivery(3000)
    const cleanupSearch = await client.callTool({
      name: 'messages',
      arguments: {
        action: 'search',
        account: TEST_ACCOUNT,
        query: `SUBJECT "${replySubject}"`,
        folder: 'INBOX',
        limit: 10
      }
    })
    const cleanupData = parseResult(cleanupSearch)
    for (const msg of cleanupData.messages) {
      if (msg.subject?.includes('MCP-TEST-') && !testUids.includes(msg.uid)) {
        testUids.push(msg.uid)
      }
    }
  }, 60_000)
})

// ===========================================================================
// 7. send.forward (requires EMAIL_CREDENTIALS)
// ===========================================================================

describe.skipIf(!HAS_CREDS)('send.forward', () => {
  const fwdSubject = testSubject('FWD')
  let originalUid: number

  it('should send original, find it, forward, and verify Fwd: prefix', async () => {
    // Step 1: Send original
    const sendResult = await client.callTool({
      name: 'send',
      arguments: {
        action: 'new',
        account: TEST_ACCOUNT,
        to: TEST_ACCOUNT,
        subject: fwdSubject,
        body: 'Original message for forward test'
      }
    })
    expect(sendResult.isError).toBeFalsy()

    await waitForDelivery(5000)

    // Step 2: Find the email
    const searchResult = await client.callTool({
      name: 'messages',
      arguments: {
        action: 'search',
        account: TEST_ACCOUNT,
        query: `SUBJECT "${fwdSubject}"`,
        folder: 'INBOX',
        limit: 5
      }
    })
    const searchData = parseResult(searchResult)
    const found = searchData.messages.find((m: any) => m.subject?.includes('MCP-TEST-'))
    expect(found).toBeDefined()
    originalUid = found.uid
    testUids.push(originalUid)

    // Step 3: Forward to self
    const fwdResult = await client.callTool({
      name: 'send',
      arguments: {
        action: 'forward',
        account: TEST_ACCOUNT,
        uid: originalUid,
        to: TEST_ACCOUNT,
        body: 'Forwarding this email to you'
      }
    })
    expect(fwdResult.isError).toBeFalsy()
    const fwdData = parseResult(fwdResult)
    expect(fwdData.action).toBe('forward')
    expect(fwdData.success).toBe(true)
    expect(fwdData.subject).toContain('Fwd:')

    // Cleanup: collect forwarded UIDs
    await waitForDelivery(3000)
    const cleanupSearch = await client.callTool({
      name: 'messages',
      arguments: {
        action: 'search',
        account: TEST_ACCOUNT,
        query: `SUBJECT "${fwdSubject}"`,
        folder: 'INBOX',
        limit: 10
      }
    })
    const cleanupData = parseResult(cleanupSearch)
    for (const msg of cleanupData.messages) {
      if (msg.subject?.includes('MCP-TEST-') && !testUids.includes(msg.uid)) {
        testUids.push(msg.uid)
      }
    }
  }, 60_000)
})

// ===========================================================================
// 8. attachments (requires EMAIL_CREDENTIALS)
// ===========================================================================

describe.skipIf(!HAS_CREDS)('attachments', () => {
  const attSubject = testSubject('ATT')
  let emailUid: number

  it('attachments.list -- list attachments on a text email (0 expected)', async () => {
    // Send an email to self (no attachment support in send tool)
    const sendResult = await client.callTool({
      name: 'send',
      arguments: {
        action: 'new',
        account: TEST_ACCOUNT,
        to: TEST_ACCOUNT,
        subject: attSubject,
        body: 'Email for attachment list test'
      }
    })
    expect(sendResult.isError).toBeFalsy()

    await waitForDelivery(5000)

    // Find the email
    const searchResult = await client.callTool({
      name: 'messages',
      arguments: {
        action: 'search',
        account: TEST_ACCOUNT,
        query: `SUBJECT "${attSubject}"`,
        folder: 'INBOX',
        limit: 5
      }
    })
    const searchData = parseResult(searchResult)
    const found = searchData.messages.find((m: any) => m.subject?.includes('MCP-TEST-'))
    expect(found).toBeDefined()
    emailUid = found.uid
    testUids.push(emailUid)

    // List attachments
    const result = await client.callTool({
      name: 'attachments',
      arguments: {
        action: 'list',
        account: TEST_ACCOUNT,
        uid: emailUid
      }
    })

    expect(result.isError).toBeFalsy()
    const data = parseResult(result)
    expect(data.action).toBe('list')
    expect(data.account).toBe(TEST_ACCOUNT)
    expect(data.uid).toBe(emailUid)
    expect(data.total).toBe(0)
    expect(data.attachments).toEqual([])
  }, 60_000)

  it('attachments.download -- should error when no filename provided', async () => {
    expect(emailUid).toBeDefined()

    const result = await client.callTool({
      name: 'attachments',
      arguments: {
        action: 'download',
        account: TEST_ACCOUNT,
        uid: emailUid
        // No filename -- should error
      }
    })

    expect(result.isError).toBe(true)
    const text = (result.content as Array<{ type: string; text: string }>)[0]?.text
    expect(text).toContain('filename')
  }, 30_000)
})

// ===========================================================================
// 9. error handling (no credentials needed for most, mixed)
// ===========================================================================

describe('error handling', () => {
  it('should return error for unknown tool', async () => {
    const result = await client.callTool({
      name: 'nonexistent_tool',
      arguments: { action: 'test' }
    })
    expect(result.isError).toBe(true)
    const text = (result.content as Array<{ type: string; text: string }>)[0]?.text
    expect(text).toContain('Unknown tool')
  })

  it('should return error when no arguments provided', async () => {
    const result = await client.callTool({
      name: 'messages',
      arguments: undefined as any
    })
    expect(result.isError).toBe(true)
    const text = (result.content as Array<{ type: string; text: string }>)[0]?.text
    expect(text).toContain('No arguments provided')
  })

  // No-accounts hint: only meaningful when the server truly has zero accounts.
  // The server may auto-load credentials from saved OAuth tokens or relay config
  // even without EMAIL_CREDENTIALS env var. We skip these tests when credentials
  // are set, AND test with a fake account that will never match.
  describe.skipIf(HAS_CREDS)('no-accounts hints', () => {
    it('messages should return error when no accounts exist or account not found', async () => {
      const result = await client.callTool({
        name: 'messages',
        arguments: { action: 'search', account: 'nonexistent-e2e@example.invalid' }
      })
      expect(result.isError).toBe(true)
      const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? ''
      expect(text).toBeTruthy()
      // Server returns either "No email accounts configured" (zero accounts)
      // or "Account not found" (has accounts but this one doesn't match)
      expect(text.includes('No email accounts') || text.includes('Account not found')).toBe(true)
    })

    it('folders should return error when no accounts exist or account not found', async () => {
      const result = await client.callTool({
        name: 'folders',
        arguments: { action: 'list', account: 'nonexistent-e2e@example.invalid' }
      })
      expect(result.isError).toBe(true)
      const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? ''
      expect(text).toBeTruthy()
      expect(text.includes('No email accounts') || text.includes('Account not found')).toBe(true)
    })

    it('attachments should return error when no accounts exist or account not found', async () => {
      const result = await client.callTool({
        name: 'attachments',
        arguments: { action: 'list', account: 'nonexistent-e2e@example.invalid', uid: 1 }
      })
      expect(result.isError).toBe(true)
      const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? ''
      expect(text).toBeTruthy()
      expect(text.includes('No email accounts') || text.includes('Account not found')).toBe(true)
    })

    it('send should return error when no accounts exist or account not found', async () => {
      const result = await client.callTool({
        name: 'send',
        arguments: {
          action: 'new',
          account: 'nonexistent-e2e@example.invalid',
          to: 'a@b.com',
          subject: 'test',
          body: 'test'
        }
      })
      expect(result.isError).toBe(true)
      const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? ''
      expect(text).toBeTruthy()
      expect(text.includes('No email accounts') || text.includes('Account not found')).toBe(true)
    })
  })

  it.skipIf(!HAS_CREDS)('should reject operations for unconfigured account', async () => {
    const result = await client.callTool({
      name: 'messages',
      arguments: {
        action: 'search',
        account: 'nonexistent@example.com'
      }
    })

    expect(result.isError).toBe(true)
    const text = (result.content as Array<{ type: string; text: string }>)[0]?.text
    expect(text).toBeTruthy()
  }, 30_000)
})

// ===========================================================================
// 10. connection stability (no credentials needed)
// ===========================================================================

describe('connection stability', () => {
  it('should respond to ping', async () => {
    const result = await client.ping()
    expect(result).toBeDefined()
  })

  it('should handle rapid sequential calls without failure', async () => {
    // Fire 5 rapid help calls to verify stability under load
    const results = await Promise.all(
      EXPECTED_TOOLS.map((toolName) =>
        client.callTool({ name: 'help', arguments: { tool_name: toolName } })
      )
    )

    for (const result of results) {
      expect(result.isError).toBeFalsy()
      const text = (result.content as Array<{ type: string; text: string }>)[0]?.text
      expect(text).toBeTruthy()
    }
  }, 30_000)

  it('should respond to ping after rapid calls', async () => {
    const result = await client.ping()
    expect(result).toBeDefined()
  })
})

// ===========================================================================
// 11. HTTP Transport — Local Server
// Skip when E2E_SETUP=http because the main transport already occupies port 18080
// ===========================================================================

describe.skipIf(E2E_SETUP === 'http')('HTTP Transport — Local Server', () => {
  const HTTP_PORT = 18080
  const HTTP_URL = `http://127.0.0.1:${HTTP_PORT}`
  let httpProcess: any // ChildProcess

  beforeAll(async () => {
    const { spawn } = await import('node:child_process')
    httpProcess = spawn('node', ['bin/cli.mjs'], {
      env: {
        ...process.env,
        TRANSPORT_MODE: 'http',
        PUBLIC_URL: HTTP_URL,
        DCR_SERVER_SECRET: 'e2e-test-secret-that-is-at-least-32-bytes-long!!',
        PORT: String(HTTP_PORT),
        NODE_ENV: 'test'
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: process.cwd()
    })

    // Wait for server ready
    const deadline = Date.now() + 15_000
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${HTTP_URL}/health`)
        if (res.ok) break
      } catch {
        /* not ready */
      }
      await new Promise((r) => setTimeout(r, 500))
    }
  }, 20_000)

  afterAll(() => {
    httpProcess?.kill()
  })

  describe('Health endpoint', () => {
    it('GET /health should return ok', async () => {
      const res = await fetch(`${HTTP_URL}/health`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('ok')
      expect(body.timestamp).toBeTruthy()
    })
  })

  describe('OAuth discovery', () => {
    let metadata: any

    beforeAll(async () => {
      const res = await fetch(`${HTTP_URL}/.well-known/oauth-authorization-server`)
      expect(res.status).toBe(200)
      metadata = await res.json()
    })

    it('should have correct issuer', () => {
      expect(metadata.issuer).toContain(HTTP_URL)
    })

    it('should expose authorization_endpoint', () => {
      expect(metadata.authorization_endpoint).toBe(`${HTTP_URL}/authorize`)
    })

    it('should expose token_endpoint', () => {
      expect(metadata.token_endpoint).toBe(`${HTTP_URL}/token`)
    })

    it('should expose registration_endpoint (DCR)', () => {
      expect(metadata.registration_endpoint).toBe(`${HTTP_URL}/register`)
    })

    it('should support authorization_code grant', () => {
      expect(metadata.grant_types_supported).toContain('authorization_code')
    })

    it('should support S256 PKCE', () => {
      expect(metadata.code_challenge_methods_supported).toContain('S256')
    })
  })

  describe('DCR registration', () => {
    it('should register a new client and return client_id', async () => {
      const res = await fetch(`${HTTP_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          redirect_uris: ['http://localhost:9999/callback'],
          client_name: 'e2e-http-test-client',
          grant_types: ['authorization_code', 'refresh_token'],
          response_types: ['code'],
          token_endpoint_auth_method: 'client_secret_post'
        })
      })
      expect([200, 201]).toContain(res.status)
      const body = await res.json()
      expect(body.client_id).toBeTruthy()
    }, 30_000)

    it('should produce deterministic client_id for same input', async () => {
      const payload = {
        redirect_uris: ['http://localhost:12345/cb'],
        client_name: 'deterministic-email-e2e',
        grant_types: ['authorization_code'],
        response_types: ['code'],
        token_endpoint_auth_method: 'client_secret_post'
      }

      const res1 = await fetch(`${HTTP_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const body1 = await res1.json()

      const res2 = await fetch(`${HTTP_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const body2 = await res2.json()

      expect(body1.client_id).toBe(body2.client_id)
      expect(body1.client_secret).toBe(body2.client_secret)
    }, 30_000)
  })

  describe('Credential relay page', () => {
    let clientId: string

    beforeAll(async () => {
      const res = await fetch(`${HTTP_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          redirect_uris: ['http://localhost:8888/callback'],
          client_name: 'relay-page-e2e',
          grant_types: ['authorization_code'],
          response_types: ['code'],
          token_endpoint_auth_method: 'client_secret_post'
        })
      })
      const body = await res.json()
      clientId = body.client_id
    })

    it('GET /auth/relay with valid state should return HTML form', async () => {
      const authorizeUrl = new URL(`${HTTP_URL}/authorize`)
      authorizeUrl.searchParams.set('response_type', 'code')
      authorizeUrl.searchParams.set('client_id', clientId)
      authorizeUrl.searchParams.set('redirect_uri', 'http://localhost:8888/callback')
      authorizeUrl.searchParams.set('code_challenge', 'test-challenge')
      authorizeUrl.searchParams.set('code_challenge_method', 'S256')
      authorizeUrl.searchParams.set('state', 'test-state-relay')

      const res = await fetch(authorizeUrl.toString(), { redirect: 'manual' })
      // Should redirect to relay credential form
      const location = res.headers.get('location') ?? ''
      if (location.includes('/auth/relay')) {
        const relayRes = await fetch(location.startsWith('http') ? location : `${HTTP_URL}${location}`)
        expect(relayRes.status).toBe(200)
        const html = await relayRes.text()
        expect(html).toContain('<form')
      } else {
        // Some implementations render the form inline
        expect([200, 302, 303]).toContain(res.status)
      }
    }, 30_000)

    it('POST /auth/credentials with invalid state should return 400', async () => {
      const res = await fetch(`${HTTP_URL}/auth/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: 'nonexistent-state',
          email: 'test@example.com',
          password: 'fake-pass'
        })
      })
      expect(res.status).toBeGreaterThanOrEqual(400)
    }, 30_000)
  })

  describe('MCP auth enforcement', () => {
    it('POST /mcp without Bearer should return 401', async () => {
      const res = await fetch(`${HTTP_URL}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: { name: 'test', version: '1.0.0' }
          }
        })
      })
      expect(res.status).toBe(401)
    }, 30_000)

    it('POST /mcp with invalid Bearer should return 401', async () => {
      const res = await fetch(`${HTTP_URL}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid-token-e2e'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: { name: 'test', version: '1.0.0' }
          }
        })
      })
      expect(res.status).toBe(401)
    }, 30_000)
  })

  describe('Multi-user session isolation', () => {
    it('should produce different client_ids for different clients', async () => {
      const base = {
        client_name: 'isolation-e2e',
        grant_types: ['authorization_code'],
        response_types: ['code'],
        token_endpoint_auth_method: 'client_secret_post'
      }

      const res1 = await fetch(`${HTTP_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...base, redirect_uris: ['http://localhost:3001/cb'] })
      })
      const body1 = await res1.json()

      const res2 = await fetch(`${HTTP_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...base, redirect_uris: ['http://localhost:3002/cb'] })
      })
      const body2 = await res2.json()

      expect(body1.client_id).toBeTruthy()
      expect(body2.client_id).toBeTruthy()
      expect(body1.client_id).not.toBe(body2.client_id)
    }, 30_000)
  })
})
