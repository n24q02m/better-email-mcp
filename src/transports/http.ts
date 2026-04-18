/**
 * HTTP Transport -- dispatches between two modes per MCP mode matrix:
 *
 *   MCP_MODE=remote-relay (default) -- runLocalServer with delegatedOAuth
 *     {flow:'device_code', upstream: Outlook} for Outlook accounts. Per-account
 *     tokens saved to ~/.better-email-mcp/tokens.json via onTokenReceived.
 *     OUTLOOK_CLIENT_ID env var is required.
 *
 *   MCP_MODE=local-relay -- runLocalServer with relaySchema (paste
 *     email:app-password for Gmail/Yahoo/iCloud). Validates via real IMAP
 *     before accepting. Outlook accounts trigger Device Code flow in-band via
 *     the credential form's oauth_device_code NextStep.
 *
 * Credential lifecycle (both modes):
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

import { buildOutlookUpstream } from '../auth/outlook-device-code.js'
import { renderEmailCredentialForm } from '../credential-form.js'
import {
  getMarkSetupComplete as getCredentialMarkSetupComplete,
  resolveCredentialState,
  setMarkSetupComplete,
  setState
} from '../credential-state.js'
import { RELAY_SCHEMA } from '../relay-schema.js'
import { type AccountConfig, loadConfig, parseCredentials } from '../tools/helpers/config.js'
import {
  getClientId as getOutlookClientId,
  initiateOutlookDeviceCode,
  isOutlookDomain,
  saveOutlookTokens
} from '../tools/helpers/oauth2.js'
import { registerTools } from '../tools/registry.js'

const SERVER_NAME = 'better-email-mcp'
const IMAP_CONNECT_TIMEOUT_MS = 15_000

export type HttpMode = 'remote-relay' | 'local-relay'

export function resolveHttpMode(env: NodeJS.ProcessEnv): HttpMode {
  const raw = env.MCP_MODE?.toLowerCase().trim()
  if (raw === 'local-relay' || raw === 'remote-relay') return raw
  return 'remote-relay'
}

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
  const mode = resolveHttpMode(process.env)

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

  const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 0
  const host = process.env.HOST

  if (mode === 'remote-relay') {
    // Uses bundled Azure AD app client ID by default; override with
    // OUTLOOK_CLIENT_ID env var for self-host with a custom registered app.
    const clientId = getOutlookClientId()

    const handle = await runLocalServer(serverFactory, {
      serverName: SERVER_NAME,
      port,
      host,
      delegatedOAuth: {
        flow: 'device_code',
        upstream: buildOutlookUpstream({ clientId }),
        onTokenReceived: async (tokens) => {
          await saveOutlookTokens(tokens)
          // Reload accounts so subsequent tool calls pick up the new Outlook token.
          currentAccounts = await loadConfig()
          setState('configured')
          console.error(`[${SERVER_NAME}] Outlook OAuth2 token received and saved`)
        }
      }
    })

    console.error(`[${SERVER_NAME}] remote-relay mode on http://${handle.host}:${handle.port}/mcp`)

    await new Promise<void>((resolve) => {
      const shutdown = async () => {
        await handle.close()
        resolve()
      }
      process.once('SIGINT', shutdown)
      process.once('SIGTERM', shutdown)
    })
    return
  }

  // local-relay mode: email:app-password via relay schema form
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

    // Split Outlook (OAuth2) vs password (IMAP) accounts. Outlook accounts
    // are valid even without a password -- parseCredentials tags them as
    // ``authType === 'oauth2'`` and loads any pre-existing tokens from disk.
    const outlookAccounts: AccountConfig[] = []
    const imapAccounts: AccountConfig[] = []
    for (const account of accounts) {
      if (isOutlookDomain(account.email) || account.authType === 'oauth2') {
        outlookAccounts.push(account)
      } else {
        imapAccounts.push(account)
      }
    }

    // Validate every IMAP/SMTP (password) account via real IMAP login first
    // so credential errors are surfaced before we touch Microsoft OAuth.
    const results = await Promise.all(
      imapAccounts.map(async (account) => {
        const result = await testImapConnection(account)
        if (result === null) {
          console.error(`[${SERVER_NAME}] IMAP login OK for ${account.email}`)
        }
        return result
      })
    )

    const firstError = results.find((r) => r !== null)
    if (firstError) return firstError

    // Persist credentials (including Outlook email-only entries) so a server
    // restart picks them up without re-running the form. Background OAuth
    // tokens are written separately to ~/.better-email-mcp/tokens.json by
    // the device-code poll.
    try {
      await writeConfig(SERVER_NAME, { EMAIL_CREDENTIALS: raw })
    } catch (err) {
      console.error(`[${SERVER_NAME}] Failed to persist credentials: ${(err as Error).message}`)
    }
    process.env.EMAIL_CREDENTIALS = raw
    currentAccounts = accounts
    console.error(`[${SERVER_NAME}] ${accounts.length} email account(s) configured via /authorize`)

    // Outlook accounts that still need OAuth2 sign-in -- no stored tokens
    // yet. Initiate Device Code flow for the FIRST such account and return
    // an oauth_device_code NextStep so the form can show the URL/code.
    // (Multi-Outlook: second+ accounts are handled lazily on first tool
    // call via ensureValidToken; they'll throw a descriptive error with
    // their own device code.)
    const outlookPending = outlookAccounts.filter((a) => !a.oauth2)
    if (outlookPending.length > 0) {
      const first = outlookPending[0] as AccountConfig
      try {
        const device = await initiateOutlookDeviceCode(first.email, () => {
          // Tokens persisted. Flip /setup-status so the form stops polling.
          const hook = getCredentialMarkSetupComplete()
          if (hook) hook('outlook')
          setState('configured')
          console.error(`[${SERVER_NAME}] Outlook OAuth2 completed for ${first.email}`)
        })
        // Stay in setup_in_progress until the background poll succeeds.
        setState('setup_in_progress')
        return {
          type: 'oauth_device_code',
          verification_url: device.verificationUri,
          user_code: device.userCode,
          email: first.email
        }
      } catch (err) {
        return {
          type: 'error',
          text: `Failed to start Outlook OAuth2 Device Code flow for ${first.email}: ${(err as Error).message}`
        }
      }
    }

    setState('configured')
    return null
  }

  const handle = await runLocalServer(serverFactory, {
    serverName: SERVER_NAME,
    relaySchema: RELAY_SCHEMA as unknown as RelayConfigSchema,
    port,
    host,
    onCredentialsSaved,
    customCredentialFormHtml: renderEmailCredentialForm,
    setupCompleteHook: (markComplete) => {
      // mcp-core hands us a ``markSetupComplete(key)`` callback here. Stash
      // it in credential-state so the Outlook OAuth background poll (which
      // lives in oauth2.ts) can signal completion to ``/setup-status`` and
      // unblock the credential form's status spinner.
      setMarkSetupComplete(markComplete)
    }
  })

  console.error(`[${SERVER_NAME}] local-relay mode on http://${handle.host}:${handle.port}/mcp`)
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
