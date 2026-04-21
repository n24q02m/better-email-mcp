/**
 * Shared ``runLocalServer`` spawn options for better-email-mcp.
 *
 * The HTTP transport (``transports/http.ts``) and the stdio fallback
 * (``credential-state.ts:triggerRelaySetup``) both mount an identical
 * credential form: the multi-account ``renderEmailCredentialForm`` that
 * handles Gmail/Yahoo/iCloud/custom IMAP + Outlook OAuth2 device code in
 * one UI. This module factors out the shared wiring so the three modes
 * (``remote-relay``, ``local-relay``, ``stdio``) present the SAME form
 * and SAME onCredentialsSaved behaviour -- only the storage scope and
 * whether the server stays alive afterwards differ.
 *
 * See ``~/.claude/skills/mcp-dev/references/mode-matrix.md`` section
 * ``stdio proxy`` + the ``relay_mode_ui_parity`` memory entry for the rule.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { NextStep, RelayConfigSchema, RunLocalServerOptions, SubjectContext } from '@n24q02m/mcp-core'
import { writeConfig } from '@n24q02m/mcp-core'
import { ImapFlow } from 'imapflow'

import { storeUserCredentials } from './auth/per-user-credential-store.js'
import { renderEmailCredentialForm } from './credential-form.js'
import {
  getMarkSetupComplete as getCredentialMarkSetupComplete,
  setMarkSetupComplete,
  setState
} from './credential-state.js'
import { RELAY_SCHEMA } from './relay-schema.js'
import { type AccountConfig, parseCredentials } from './tools/helpers/config.js'
import { initiateOutlookDeviceCode, isOutlookDomain } from './tools/helpers/oauth2.js'

const SERVER_NAME = 'better-email-mcp'
const IMAP_CONNECT_TIMEOUT_MS = 15_000

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

/** Initiate Microsoft Device Code flow for the first Outlook account pending auth. */
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

export interface SpawnCredentialFormArgs {
  /** Build the MCP server that answers ``/mcp``. Stdio fallback passes a stub. */
  serverFactory: () => McpServer
  /** TCP port. ``0`` = auto-pick free port. */
  port?: number
  /** Host to bind. Defaults to ``127.0.0.1``. */
  host?: string
  /** Mode label -- used in ``/mcp`` log + internal behaviour hints. */
  mode: 'remote-relay' | 'local-relay' | 'stdio'
  /**
   * Optional hook fired after ``onCredentialsSaved`` parses + validates
   * accounts successfully. HTTP transports use this to refresh their
   * ``currentAccounts`` closure so subsequent tool calls see the new mailbox
   * set without restart. Stdio fallback leaves this undefined -- its tool
   * registry lives in the parent process and re-reads ``config.enc`` via
   * ``loadConfig()`` on each call.
   */
  onAccountsLoaded?: (accounts: AccountConfig[]) => void
}

/**
 * Build the shared ``RunLocalServerOptions`` used by all three email modes.
 *
 * The returned ``onCredentialsSaved`` + ``customCredentialFormHtml`` +
 * ``setupCompleteHook`` are identical across modes, so the browser form
 * (``renderEmailCredentialForm``) and the backend behaviour behind it
 * (parse + IMAP validation + Outlook Device Code + config persistence)
 * are guaranteed to match between remote-relay, local-relay, and stdio.
 */
export function buildRunLocalServerOptions(args: SpawnCredentialFormArgs): RunLocalServerOptions {
  const { serverFactory: _serverFactory, port = 0, host, mode, onAccountsLoaded } = args

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
        outlookAccounts.push(account)
      } else {
        imapAccounts.push(account)
      }
    }

    const imapResult = await validateImapAccounts(imapAccounts)
    if (imapResult) return imapResult

    // Persistence strategy depends on mode:
    //
    // - ``remote-relay`` is the multi-user path served on a public URL. The
    //   JWT ``sub`` passed in via ``context`` keys a per-user encrypted
    //   credential file (``storeUserCredentials``). We deliberately do NOT
    //   write to the shared ``config.enc`` or set ``process.env.EMAIL_CREDENTIALS``
    //   -- doing so would leak user A's mailboxes to every other caller of the
    //   same container, which is the 2026-04-21 security incident.
    // - ``local-relay`` + ``stdio`` are single-user (one host per person).
    //   Keep the existing shared-config path so tools can read
    //   ``process.env.EMAIL_CREDENTIALS`` the way they always have, and the
    //   encrypted ``config.enc`` survives restarts.
    if (mode === 'remote-relay') {
      try {
        await storeUserCredentials(context.sub, accounts)
      } catch (err) {
        console.error(
          `[${SERVER_NAME}] Failed to persist per-user credentials for sub=${context.sub}: ${(err as Error).message}`
        )
        return { type: 'error', text: 'Failed to save credentials. Please retry.' }
      }
      console.error(
        `[${SERVER_NAME}] ${accounts.length} email account(s) configured for sub=${context.sub} (mode=remote-relay, per-user scope)`
      )
    } else {
      try {
        await writeConfig(SERVER_NAME, { EMAIL_CREDENTIALS: raw })
      } catch (err) {
        console.error(`[${SERVER_NAME}] Failed to persist credentials: ${(err as Error).message}`)
      }
      process.env.EMAIL_CREDENTIALS = raw
      if (onAccountsLoaded) onAccountsLoaded(accounts)
      console.error(`[${SERVER_NAME}] ${accounts.length} email account(s) configured via /authorize (mode=${mode})`)
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
