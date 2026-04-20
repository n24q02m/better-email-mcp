/**
 * HTTP Transport -- unified credential form for both local-relay and
 * remote-relay modes per the MCP mode matrix.
 *
 * Both modes render the SAME multi-provider paste form
 * (Gmail/Yahoo/iCloud/custom IMAP + Outlook) via ``relaySchema +
 * renderEmailCredentialForm``. Outlook accounts trigger the Microsoft
 * Device Code flow in-band through the ``oauth_device_code`` NextStep; the
 * rest validate with a real IMAP login. UI and flow are identical between
 * modes -- only the storage scope differs (see below).
 *
 * Modes (selected via ``MCP_MODE`` env var, default ``remote-relay``):
 *   - ``local-relay``  -> single-user. Credentials persist to the encrypted
 *                         config.enc file plus ``process.env.EMAIL_CREDENTIALS``
 *                         so every tool call hits the same mailbox set.
 *   - ``remote-relay`` -> multi-user (target). Per-session credentials keyed
 *                         by the JWT ``sub`` claim issued by the local OAuth
 *                         AS; two browsers opening the same URL never see
 *                         each other's mailbox data.
 *
 * Multi-user storage for ``remote-relay`` currently falls back to the
 * single-user path because the upstream ``runLocalServer(relaySchema)``
 * primitive in mcp-core issues a static ``sub='local-user'`` for all
 * sessions. Follow-up: mcp-core v1.5+ will generate a per-session UUID
 * subject and thread it through to ``onCredentialsSaved``; this module
 * will switch the remote-relay branch to call ``storeUserCredentials(sub,
 * accounts)`` without any UI change.
 *
 * Lifecycle (both modes):
 *  - ``resolveCredentialState()`` loads any existing EMAIL_CREDENTIALS from
 *    env / encrypted config at boot so tools work immediately.
 *  - Missing credentials -> server still starts; tools return setup
 *    instructions pointing to ``/authorize`` until the user submits.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { type NextStep, type RelayConfigSchema, runLocalServer, writeConfig } from '@n24q02m/mcp-core'
import { ImapFlow } from 'imapflow'

import { renderEmailCredentialForm } from '../credential-form.js'
import {
  getMarkSetupComplete as getCredentialMarkSetupComplete,
  resolveCredentialState,
  setMarkSetupComplete,
  setState
} from '../credential-state.js'
import { RELAY_SCHEMA } from '../relay-schema.js'
import { type AccountConfig, loadConfig, parseCredentials } from '../tools/helpers/config.js'
import { initiateOutlookDeviceCode, isOutlookDomain } from '../tools/helpers/oauth2.js'
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

/**
 * Validate every IMAP/SMTP (password) account via real IMAP login.
 * Runs tests in parallel to reduce latency. Returns null if all OK,
 * or the first NextStep error if any fails.
 */
async function validateImapAccounts(imapAccounts: AccountConfig[]): Promise<NextStep | null> {
  const results = await Promise.all(
    imapAccounts.map(async (account) => {
      const result = await testImapConnection(account)
      if (result === null) {
        console.error(`[${SERVER_NAME}] IMAP login OK for ${account.email}`)
      }
      return result
    })
  )

  return results.find((r) => r !== null) ?? null
}

/**
 * Initiate Outlook Device Code flow for the first account that needs it.
 */
async function initiateOutlookOAuth(outlookAccounts: AccountConfig[]): Promise<NextStep | null> {
  const outlookPending = outlookAccounts.filter((a) => !a.oauth2)
  if (outlookPending.length === 0) return null

  const first = outlookPending[0] as AccountConfig
  try {
    const device = await initiateOutlookDeviceCode(first.email, () => {
      const hook = getCredentialMarkSetupComplete()
      if (hook) hook('outlook')
      setState('configured')
      console.error(`[${SERVER_NAME}] Outlook OAuth2 completed for ${first.email}`)
    })
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

export async function startHttp(): Promise<void> {
  const mode = resolveHttpMode(process.env)

  await resolveCredentialState()

  let currentAccounts: AccountConfig[] = await loadConfig()

  const serverFactory = (): McpServer => {
    const server = new Server(
      { name: `@n24q02m/${SERVER_NAME}`, version: '0.0.0' },
      { capabilities: { tools: {}, resources: {} } }
    )
    registerTools(server, currentAccounts)
    return server as unknown as McpServer
  }

  const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 0
  const host = process.env.HOST

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
    // are valid without a password -- parseCredentials tags them as
    // authType=='oauth2' and loads any pre-existing tokens from disk.
    const outlookAccounts: AccountConfig[] = []
    const imapAccounts: AccountConfig[] = []
    for (const account of accounts) {
      if (isOutlookDomain(account.email) || account.authType === 'oauth2') {
        outlookAccounts.push(account)
      } else {
        imapAccounts.push(account)
      }
    }

    // Real IMAP login for every password account -- fails fast with a
    // per-account error message so the user sees exactly which one is bad.
    const imapResult = await validateImapAccounts(imapAccounts)
    if (imapResult) return imapResult

    // Persist credentials to config.enc so restarts don't re-prompt. Outlook
    // OAuth2 tokens are written separately to ~/.better-email-mcp/tokens.json
    // by the device-code background poll.
    try {
      await writeConfig(SERVER_NAME, { EMAIL_CREDENTIALS: raw })
    } catch (err) {
      console.error(`[${SERVER_NAME}] Failed to persist credentials: ${(err as Error).message}`)
    }
    process.env.EMAIL_CREDENTIALS = raw
    currentAccounts = accounts
    console.error(`[${SERVER_NAME}] ${accounts.length} email account(s) configured via /authorize (mode=${mode})`)

    // Outlook accounts that still need OAuth2 sign-in -- trigger the
    // Microsoft Device Code flow in-band and return the verification URL
    // for the browser to render. Works identically in both modes.
    const outlookResult = await initiateOutlookOAuth(outlookAccounts)
    if (outlookResult) return outlookResult

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
    setupCompleteHook: (markComplete: (key?: string) => void) => {
      // mcp-core hands us the markSetupComplete(key) callback here. Stash
      // it in credential-state so the Outlook OAuth background poll can
      // signal completion to /setup-status and unblock the credential
      // form's status spinner.
      setMarkSetupComplete(markComplete)
    }
  })

  console.error(`[${SERVER_NAME}] ${mode} mode on http://${handle.host}:${handle.port}/mcp`)
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
