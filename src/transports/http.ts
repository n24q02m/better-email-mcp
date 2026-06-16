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

import { PerSubCredStore } from '../auth/cred-store.js'
import { type CredStoreLike, InMemoryCredStore } from '../auth/in-memory-cred-store.js'
import { subjectContext } from '../auth/subject-context.js'
import { renderEmailCredentialForm } from '../credential-form.js'
import { resolveCredentialState, setMarkSetupComplete, setSetupUrl, setState } from '../credential-state.js'
import { RELAY_SCHEMA } from '../relay-schema.js'
import { type AccountConfig, loadConfig, parseCredentials } from '../tools/helpers/config.js'
import { initiateOutlookDeviceCode, isOutlookDomain } from '../tools/helpers/oauth2.js'
import { registerTools } from '../tools/registry.js'

const SERVER_NAME = 'better-email-mcp'
const IMAP_CONNECT_TIMEOUT_MS = 15_000

/**
 * Select the per-sub credential store. cf-kv backend -> KV write-through
 * PerSubCredStore (durable across container recreate; the Cloudflare deploy
 * store). Any other backend (stdio / local single-process) -> ephemeral
 * in-memory store. Read once at module load; on CF, MCP_STORAGE_BACKEND=cf-kv is
 * set by wrangler vars, so the durable KV store is selected there.
 */
function selectCredStore(): CredStoreLike {
  if ((process.env.MCP_STORAGE_BACKEND ?? '').toLowerCase() === 'cf-kv') {
    return new PerSubCredStore()
  }
  return new InMemoryCredStore()
}

/** Module-singleton per-user credential store (KV on CF, in-memory otherwise). */
const credStore = selectCredStore()

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

    const outlookAccounts: AccountConfig[] = []
    const imapAccounts: AccountConfig[] = []
    for (const account of accounts) {
      if (isOutlookDomain(account.email) || account.authType === 'oauth2') {
        // Force fresh device-code flow for every form submit by clearing any
        // cached tokens that ``parseCredentials`` may have populated via
        // ``loadStoredTokens``. Without this, ``initiateOutlookOAuth`` filters
        // out accounts with ``.oauth2`` set and silently returns ``null`` →
        // the form shows "Setup complete" without ever displaying the Microsoft
        // device-code step (UX bug reported 2026-04-24).
        account.oauth2 = undefined
        outlookAccounts.push(account)
      } else {
        imapAccounts.push(account)
      }
    }

    const imapResult = await validateImapAccounts(imapAccounts)
    if (imapResult) return imapResult

    // Persistence is mode-dependent to avoid cross-user credential bleed.
    //
    // Multi-user (JWT `sub` present): write ONLY to the per-user store, keyed by
    // `sub`. We must NOT touch the shared `config.enc`, `process.env`, or the
    // single-user `currentAccounts` closure — those are process-global and would
    // leak one subject's mailboxes into every other subject's tool calls.
    //
    // Single-user (no `sub`: stdio self-host / auth-disabled gateway): exactly
    // one caller, so persist to the shared `config.enc` + env + closure so
    // credentials survive restarts and are visible to non-HTTP-scoped calls.
    const sub = context?.sub
    if (sub) {
      try {
        await credStore.save(sub, { accounts })
      } catch (err) {
        console.error(`[${SERVER_NAME}] Failed to save per-user credentials for sub=${sub}: ${(err as Error).message}`)
        return { type: 'error', text: 'Failed to save credentials. Please retry.' }
      }
      console.error(`[${SERVER_NAME}] ${accounts.length} email account(s) configured for sub=${sub} (per-user scope)`)
    } else {
      try {
        await writeConfig(SERVER_NAME, { EMAIL_CREDENTIALS: raw })
      } catch (err) {
        console.error(`[${SERVER_NAME}] Failed to persist credentials: ${(err as Error).message}`)
      }
      process.env.EMAIL_CREDENTIALS = raw
      onAccountsLoaded(accounts)
      console.error(`[${SERVER_NAME}] ${accounts.length} email account(s) configured via /authorize`)
    }

    const outlookResult = await initiateOutlookOAuth(outlookAccounts)
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

  // Port resolution order: PORT (explicit) -> MCP_PORT (Cloudflare container
  // convention / mcp-core deploys) -> 0 (OS-assigned random). The CF container
  // image sets MCP_PORT; honoring it here keeps the Worker fetch target aligned
  // with the listening port without forcing a PORT override.
  const port = process.env.PORT
    ? Number.parseInt(process.env.PORT, 10)
    : process.env.MCP_PORT
      ? Number.parseInt(process.env.MCP_PORT, 10)
      : 0
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

  // Startup KV readiness probe (cf-kv / PerSubCredStore only). Confirms the
  // container -> Worker `kv.internal` outbound path is wired BEFORE the first
  // credential write, so a broken binding fails loudly at boot instead of
  // silently dropping the first user's credentials. InMemoryCredStore has no
  // `ready`, so this is a no-op for stdio / local single-process deploys.
  if (credStore.ready) {
    try {
      await credStore.ready()
      console.error(`[${SERVER_NAME}] KV store reachable (kv.internal outbound OK)`)
    } catch (err) {
      console.error(
        `[${SERVER_NAME}] KV store UNREACHABLE — per-user credentials will NOT persist: ${(err as Error).message}`
      )
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
