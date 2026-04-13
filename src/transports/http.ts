/**
 * HTTP Transport -- Local OAuth 2.1 mode via `@n24q02m/mcp-core`.
 *
 * Uses `runLocalServer` from mcp-core which:
 *  - Serves the credential form on /authorize (rendered from RELAY_SCHEMA)
 *  - Validates email:app-password via real IMAP connection in onCredentialsSaved
 *  - Stores credentials in-process (and in env var) after validation
 *  - Issues a local JWT on /token (PKCE) that the MCP client uses for Bearer auth
 *  - Routes /mcp (Bearer-protected) to a StreamableHTTPServerTransport
 *
 * Scope (L2.9): LOCAL single-user mode only. Outlook OAuth device code flow
 * deferred to Phase L2 -- Outlook accounts are rejected with a clear message
 * so users fall back to Gmail/IMAP providers for now.
 *
 * Credential lifecycle:
 *  - At startup, existing credentials from env/encrypted-config are applied
 *    via resolveCredentialState() so the MCP tools work immediately.
 *  - If not configured, the server still starts (degraded mode) and tools
 *    return setup instructions with /authorize URL until a user submits the
 *    form. onCredentialsSaved re-parses and injects the credentials, making
 *    new accounts available without restart.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { type NextStep, type RelayConfigSchema, runLocalServer, writeConfig } from '@n24q02m/mcp-core'
import { ImapFlow } from 'imapflow'

import { resolveCredentialState, setState } from '../credential-state.js'
import { RELAY_SCHEMA } from '../relay-schema.js'
import { type AccountConfig, loadConfig, parseCredentials } from '../tools/helpers/config.js'
import { isOutlookDomain } from '../tools/helpers/oauth2.js'
import { registerTools } from '../tools/registry.js'

const SERVER_NAME = 'better-email-mcp'
const IMAP_CONNECT_TIMEOUT_MS = 15_000

/**
 * Test an IMAP account by connecting + logging out.
 *
 * Returns ``null`` on success, or a NextStep error hint the relay form can
 * display so the user sees exactly which account failed and why.
 */
async function testImapConnection(account: AccountConfig): Promise<NextStep | null> {
  const client = new ImapFlow({
    host: account.imap.host,
    port: account.imap.port,
    secure: account.imap.secure,
    auth: { user: account.email, pass: account.password },
    logger: false
  })

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('IMAP connection timed out')), IMAP_CONNECT_TIMEOUT_MS)
  )

  try {
    await Promise.race([client.connect(), timeout])
    try {
      await client.logout()
    } catch {
      // Best-effort cleanup -- connect already succeeded, the test passed.
    }
    return null
  } catch (err) {
    try {
      await client.close()
    } catch {
      // Ignore cleanup errors on failed connect.
    }
    const message = (err as Error)?.message ?? 'unknown error'
    return {
      type: 'error',
      text: `IMAP connection failed for ${account.email}: ${message}`
    }
  }
}

export async function startHttp(): Promise<void> {
  // Resolve persisted credentials first (env var / encrypted config). This
  // populates process.env.EMAIL_CREDENTIALS so the factory below can load
  // accounts on first MCP request without waiting on the relay form.
  await resolveCredentialState()

  // Cache parsed accounts so every /mcp request doesn't reparse creds. Seeded
  // from resolved state; refreshed by onCredentialsSaved when the user submits
  // the form.
  let currentAccounts: AccountConfig[] = await loadConfig()

  const serverFactory = (): McpServer => {
    const server = new Server(
      { name: `@n24q02m/${SERVER_NAME}`, version: '0.0.0' },
      { capabilities: { tools: {}, resources: {} } }
    )
    registerTools(server, currentAccounts)
    // Cast: registerTools accepts the low-level Server; runLocalServer only
    // calls .connect() which both Server and McpServer implement identically.
    return server as unknown as McpServer
  }

  const onCredentialsSaved = async (creds: Record<string, string>): Promise<NextStep | null> => {
    const raw = creds?.EMAIL_CREDENTIALS?.trim()
    if (!raw) {
      return { type: 'error', text: 'Email credentials are required. Format: email:app-password' }
    }

    let accounts: AccountConfig[]
    try {
      accounts = await parseCredentials(raw)
    } catch (err) {
      return {
        type: 'error',
        text: `Failed to parse credentials: ${(err as Error)?.message ?? 'invalid format'}`
      }
    }

    if (accounts.length === 0) {
      return {
        type: 'error',
        text: 'No valid accounts parsed. Expected email:app-password (multi-account: email1:pass1,email2:pass2)'
      }
    }

    // Outlook OAuth device code flow is deferred to Phase L2. Fail fast so the
    // user sees a clear message instead of being stranded mid-setup.
    for (const account of accounts) {
      if (isOutlookDomain(account.email) || account.authType === 'oauth2') {
        return {
          type: 'error',
          text: `Outlook/Hotmail/Live accounts (${account.email}) require OAuth device code flow which is not yet available in local mode. Use Gmail, Yahoo, iCloud, Zoho, ProtonMail, or a custom IMAP host instead.`
        }
      }
    }

    // Validate every account via real IMAP connection. Any failure aborts.
    for (const account of accounts) {
      const result = await testImapConnection(account)
      if (result !== null) return result
    }

    // All accounts verified. Persist to encrypted config so we pick them up on
    // next startup, and refresh the in-process cache so subsequent /mcp calls
    // see the new accounts without a restart.
    try {
      await writeConfig(SERVER_NAME, { EMAIL_CREDENTIALS: raw })
    } catch (err) {
      console.error(`[${SERVER_NAME}] Failed to persist credentials: ${(err as Error).message}`)
    }
    process.env.EMAIL_CREDENTIALS = raw
    currentAccounts = accounts
    setState('configured')
    console.error(`[${SERVER_NAME}] ${accounts.length} email account(s) configured via /authorize`)

    return null
  }

  const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 0

  const handle = await runLocalServer(serverFactory, {
    serverName: SERVER_NAME,
    relaySchema: RELAY_SCHEMA as unknown as RelayConfigSchema,
    port,
    onCredentialsSaved
  })

  console.error(`[${SERVER_NAME}] HTTP mode on http://${handle.host}:${handle.port}/mcp`)
  if (currentAccounts.length === 0) {
    console.error(
      `[${SERVER_NAME}] Open http://${handle.host}:${handle.port}/authorize to configure your email accounts`
    )
  }

  await new Promise<void>((resolve) => {
    const shutdown = async () => {
      await handle.close()
      resolve()
    }
    process.once('SIGINT', shutdown)
    process.once('SIGTERM', shutdown)
  })
}
