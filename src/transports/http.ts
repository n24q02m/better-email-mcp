/**
 * HTTP Transport — single multi-user relay form mode.
 *
 * Per spec 2026-05-01-stdio-pure-http-multiuser.md §5.2.1, the legacy
 * `MCP_MODE = 'remote-relay' | 'local-relay'` distinction is gone. HTTP mode
 * always serves the multi-account `renderEmailCredentialForm` (Gmail / Yahoo /
 * iCloud / custom IMAP via paste form, OR Outlook OAuth via the bundled
 * Azure AD public client_id `d56f8c71-9f7c-43f4-9934-be29cb6e77b0` already in
 * `tools/helpers/oauth2.ts`). Per-user credential isolation is keyed by JWT
 * `sub` issued by the local OAuth 2.1 AS in mcp-core.
 *
 * Lifecycle:
 *  - `resolveCredentialState()` loads any existing EMAIL_CREDENTIALS from
 *    env / encrypted config at boot so tools work immediately.
 *  - Missing credentials → server still starts; tools return setup
 *    instructions pointing to `/authorize` until the user submits.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { NextStep, RelayConfigSchema, RunHttpServerOptions, SubjectContext } from '@n24q02m/mcp-core'
import { runHttpServer, writeConfig } from '@n24q02m/mcp-core'
import { ImapFlow } from 'imapflow'

import { InMemoryCredStore } from '../auth/in-memory-cred-store.js'
import { subjectContext } from '../auth/subject-context.js'
import { renderEmailCredentialForm } from '../credential-form.js'
import {
  getMarkSetupComplete,
  resolveCredentialState,
  setMarkSetupComplete,
  setSetupUrl,
  setState
} from '../credential-state.js'
import { RELAY_SCHEMA } from '../relay-schema.js'
import { type AccountConfig, loadConfig, parseCredentials } from '../tools/helpers/config.js'
import { initiateOutlookDeviceCode, isOutlookDomain } from '../tools/helpers/oauth2.js'
import { registerTools } from '../tools/registry.js'

const SERVER_NAME = 'better-email-mcp'
const IMAP_CONNECT_TIMEOUT_MS = 15_000

/** Module-singleton in-memory credential store for multi-user mode. */
const credStore = new InMemoryCredStore()

/**
 * Test an IMAP account by connecting + logging out.
 * Returns ``null`` on success, or a NextStep error hint for the form.
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
      // Connect succeeded, cleanup errors are non-fatal.
    }
    return null
  } catch (err) {
    try {
      await client.close()
    } catch {
      // Ignore.
    }
    const message = (err as Error)?.message ?? 'unknown error'
    return { type: 'error', text: `IMAP connection failed for ${account.email}: ${message}` }
  }
}

/** Validate every IMAP (password) account in parallel. */
async function validateImapAccounts(imapAccounts: AccountConfig[]): Promise<NextStep | null> {
  try {
    await Promise.all(
      imapAccounts.map(async (account) => {
        const result = await testImapConnection(account)
        if (result !== null) {
          throw result // Fail fast: short-circuit Promise.all
        }
        console.error(`[${SERVER_NAME}] IMAP login OK for ${account.email}`)
      })
    )
    return null
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'type' in error) {
      return error as NextStep
    }
    throw error
  }
}

/** Initiate Microsoft Device Code flow for the first Outlook account pending auth. */
async function initiateOutlookOAuth(outlookAccounts: AccountConfig[]): Promise<NextStep | null> {
  const outlookPending = outlookAccounts.filter((a) => !a.oauth2)
  if (outlookPending.length === 0) return null

  const first = outlookPending[0] as AccountConfig
  try {
    const device = await initiateOutlookDeviceCode(first.email, () => {
      setState('configured')
      // Flip GET /setup-status outlook key to "complete" so the credential
      // form's poll (src/credential-form.ts:564 ``s.outlook === "complete"``)
      // stops spinning and follows the OAuth redirect_url. Without this the
      // hook fires only on form-side `mark_setup_complete()` paths (gdrive
      // default key) — Outlook device-code completion never matches.
      try {
        getMarkSetupComplete()?.('outlook')
      } catch {
        // Best-effort: never let a failed setup-status flip break OAuth.
      }
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
/**
 * Categorize accounts into Outlook (OAuth2) and IMAP (Password) groups.
 * Also resets .oauth2 tokens to force fresh device-code flows on submission.
 */
function categorizeAccounts(accounts: AccountConfig[]): {
  outlook: AccountConfig[]
  imap: AccountConfig[]
} {
  const outlook: AccountConfig[] = []
  const imap: AccountConfig[] = []
  for (const account of accounts) {
    if (isOutlookDomain(account.email) || account.authType === 'oauth2') {
      account.oauth2 = undefined
      outlook.push(account)
    } else {
      imap.push(account)
    }
  }
  return { outlook, imap }
}

/**
 * Persist credentials to per-user store and shared config.enc fallback.
 */
async function persistAccounts(
  raw: string,
  accounts: AccountConfig[],
  context: SubjectContext,
  onAccountsLoaded: (accounts: AccountConfig[]) => void
): Promise<NextStep | null> {
  const sub = context?.sub
  if (sub) {
    try {
      await credStore.save(sub, { accounts })
    } catch (err) {
      console.error(`[${SERVER_NAME}] Failed to save per-user credentials for sub=${sub}: ${(err as Error).message}`)
      return { type: 'error', text: 'Failed to save credentials. Please retry.' }
    }
    console.error(`[${SERVER_NAME}] ${accounts.length} email account(s) configured for sub=${sub} (per-user scope)`)
  }

  try {
    await writeConfig(SERVER_NAME, { EMAIL_CREDENTIALS: raw })
  } catch (err) {
    console.error(`[${SERVER_NAME}] Failed to persist credentials: ${(err as Error).message}`)
  }

  process.env.EMAIL_CREDENTIALS = raw
  onAccountsLoaded(accounts)
  console.error(`[${SERVER_NAME}] ${accounts.length} email account(s) configured via /authorize`)
  return null
}

/**
 * Build `RunHttpServerOptions` for the email HTTP mode. Per-user credentials
 * are keyed by the JWT `sub` from `SubjectContext`; the shared `config.enc`
 * is also written so single-user self-host deployments work the same way.
 */
function buildOptions(args: {
  serverFactory: () => McpServer
  port: number
  host: string | undefined
  onAccountsLoaded: (accounts: AccountConfig[]) => void
}): RunHttpServerOptions {
  const { port, host, onAccountsLoaded } = args

  const onCredentialsSaved = async (
    creds: Record<string, string>,
    context: SubjectContext
  ): Promise<NextStep | null> => {
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

    const { outlook, imap } = categorizeAccounts(accounts)

    const imapResult = await validateImapAccounts(imap)
    if (imapResult) return imapResult

    const persistResult = await persistAccounts(raw, accounts, context, onAccountsLoaded)
    if (persistResult) return persistResult

    const outlookResult = await initiateOutlookOAuth(outlook)
    if (outlookResult) return outlookResult

    setState('configured')
    return null
  }

  return {
    serverName: SERVER_NAME,
    relaySchema: RELAY_SCHEMA as unknown as RelayConfigSchema,
    port,
    host,
    onCredentialsSaved,
    customCredentialFormHtml: renderEmailCredentialForm,
    setupCompleteHook: (markComplete: (key?: string) => void) => {
      setMarkSetupComplete(markComplete)
    }
  }
}

export async function startHttp(): Promise<void> {
  await resolveCredentialState()

  let currentAccounts: AccountConfig[] = await loadConfig()

  const serverFactory = (): McpServer => {
    // Per-request mailbox resolution: prefer the per-user accounts attached
    // to the current AsyncLocalStorage scope (set by the ``authScope``
    // middleware below, keyed by JWT ``sub``). If the scope is absent (not
    // a /mcp request) we fall back to the single-user closure loaded at
    // startup.
    const scope = subjectContext.getStore()
    const accountsForThisRequest = scope?.accounts ?? currentAccounts
    const server = new Server(
      { name: `@n24q02m/${SERVER_NAME}`, version: '0.0.0' },
      { capabilities: { tools: {}, resources: {} } }
    )
    registerTools(server, accountsForThisRequest)
    return server as unknown as McpServer
  }

  const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 0
  const host = process.env.HOST

  const baseOptions = buildOptions({
    serverFactory,
    port,
    host,
    onAccountsLoaded: (accounts) => {
      currentAccounts = accounts
    }
  })

  // Per-request subject scoping: for each verified /mcp request, load this
  // subject's mailbox list from the per-user store and attach it to the
  // AsyncLocalStorage scope so ``serverFactory`` can thread it into
  // ``registerTools``. Missing subject ⇒ empty account list ⇒ tools respond
  // with a setup prompt.
  // MCP_AUTH_DISABLE=1 skips Bearer JWT verification — intended for
  // deployments behind a reverse proxy / API gateway (agentgateway, etc.)
  // that already enforces authentication. Caller's responsibility to lock
  // down network access to /mcp. See mcp-core RunHttpServerOptions.
  const authDisabled = process.env.MCP_AUTH_DISABLE === '1'

  const options = {
    ...baseOptions,
    authDisabled,
    authScope: async (claims: { sub?: unknown; anonymous?: unknown }, next: () => Promise<void>) => {
      const sub = typeof claims.sub === 'string' ? claims.sub : null
      // Anonymous (auth-disabled) caller: skip per-user store lookup and let
      // serverFactory fall back to env-loaded currentAccounts (single-user
      // deployment). Caller is single user behind external auth boundary.
      if (!sub || claims.anonymous === true) {
        await next()
        return
      }
      const payload = await credStore.load(sub)
      const accounts = (payload?.accounts as AccountConfig[] | undefined) ?? []
      await subjectContext.run({ sub, accounts }, next)
    }
  }

  const handle = await runHttpServer(serverFactory, options)

  const setupUrl = `http://${handle.host}:${handle.port}/authorize`
  setSetupUrl(setupUrl)
  console.error(`[${SERVER_NAME}] HTTP mode on http://${handle.host}:${handle.port}/mcp`)
  if (currentAccounts.length === 0) {
    console.error(`[${SERVER_NAME}] Open ${setupUrl} to configure your email accounts`)
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
