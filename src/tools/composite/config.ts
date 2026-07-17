/**
 * Config Tool
 * Unified credential lifecycle + runtime configuration.
 * Replaces the former `setup` tool with canonical name `config`.
 *
 * Setup actions (credential lifecycle):
 *   status, setup_status, setup_start, setup_reset, setup_complete
 *
 * Runtime config actions:
 *   set, cache_clear
 */

import { currentSub } from '../../auth/subject-context.js'
import type { CredentialState } from '../../credential-state.js'
import { getSetupUrl, getState, resetState, resolveCredentialState } from '../../credential-state.js'
import type { AccountConfig } from '../helpers/config.js'
import { createUnknownActionError, withErrorHandling } from '../helpers/errors.js'
import { clearSentFolderCache } from '../helpers/imap-client.js'
import { _resetTokenCache } from '../helpers/oauth2.js'
import { clearArchiveFolderCache } from './messages.js'

export interface ConfigInput {
  action: 'status' | 'setup_status' | 'setup_start' | 'setup_reset' | 'setup_complete' | 'set' | 'cache_clear'
  force?: boolean
  key?: string
  value?: string
}

interface ConfigStatusResult {
  action: 'status'
  state: CredentialState
  setup_url: string | null
  accounts: string[]
}

interface ConfigSetupStatusResult {
  action: 'setup_status'
  state: CredentialState
  setup_url: string | null
}

interface ConfigSetupStartResult {
  action: 'setup_start'
  state: CredentialState
  setup_url: string | null
}

interface ConfigSetupResetResult {
  action: 'setup_reset'
  state: CredentialState
  message: string
}

interface ConfigSetupCompleteResult {
  action: 'setup_complete'
  previous_state: CredentialState
  state: CredentialState
  accounts: string[]
}

interface ConfigSetResult {
  action: 'set'
  ok: false
  text: string
}

interface ConfigCacheClearResult {
  action: 'cache_clear'
  ok: true
  cleared: number
}

type ConfigResult =
  | ConfigStatusResult
  | ConfigSetupStatusResult
  | ConfigSetupStartResult
  | ConfigSetupResetResult
  | ConfigSetupCompleteResult
  | ConfigSetResult
  | ConfigCacheClearResult

/**
 * Unified config tool - credential lifecycle + runtime settings
 */
export async function handleConfig(accounts: AccountConfig[], input: ConfigInput): Promise<ConfigResult> {
  return withErrorHandling(async () => {
    switch (input.action) {
      case 'status':
        return handleStatus(accounts)

      case 'setup_status':
        return handleSetupStatus(accounts)

      case 'setup_start':
        return await handleSetupStart(input)

      case 'setup_reset':
        return await handleSetupReset()

      case 'setup_complete':
        return await handleSetupComplete(accounts)

      case 'set':
        return handleSet()

      case 'cache_clear':
        return handleCacheClear()

      default:
        throw createUnknownActionError(
          input.action,
          'status, setup_status, setup_start, setup_reset, setup_complete, set, cache_clear'
        )
    }
  })()
}

// Per-subject credential state (multi-user / Cloudflare). When the request
// carries a JWT `sub` scope, the process-wide single-user `getState()`
// lifecycle is meaningless: a per-sub container may only ever READ blobs from
// KV and never run the single-user save that flips getState() to
// 'configured', so it would forever report 'awaiting_setup' even though the
// caller's accounts resolved (the `folders`/`messages` tools work). Derive the
// state from whether THIS subject's accounts resolved instead. Single-user
// (no sub: stdio / auth-disabled gateway) keeps the global credential-state
// machine, which also distinguishes 'setup_in_progress' (Outlook device-code
// pending). Shared by `status` and `setup_status` so both stay consistent.
function resolveConfigState(accounts: AccountConfig[]): CredentialState {
  const sub = currentSub()
  return sub ? (accounts.length > 0 ? 'configured' : 'awaiting_setup') : getState()
}

function handleStatus(accounts: AccountConfig[]): ConfigStatusResult {
  return {
    action: 'status',
    state: resolveConfigState(accounts),
    setup_url: getSetupUrl(),
    accounts: accounts.map((a) => a.email)
  }
}

// Credential/setup-only view of `status` (no `accounts` list), for
// cross-server tool-surface parity with wet/mnemo/telegram's
// `config(action="setup_status")`. `status` keeps returning `accounts` too
// (backward compatible; unchanged behavior).
function handleSetupStatus(accounts: AccountConfig[]): ConfigSetupStatusResult {
  return {
    action: 'setup_status',
    state: resolveConfigState(accounts),
    setup_url: getSetupUrl()
  }
}

async function handleSetupStart(_input: ConfigInput): Promise<ConfigSetupStartResult> {
  // Per spec 2026-05-01-stdio-pure-http-multiuser.md §5.2.1, the legacy
  // triggerRelaySetup spawn was deleted. In HTTP mode the relay form is
  // already running on /authorize (the same process serves it); use
  // `config__open_relay` to open it. In stdio mode there is no setup URL —
  // credentials come from env vars validated up front in init-server.
  return {
    action: 'setup_start',
    state: getState(),
    setup_url: getSetupUrl()
  }
}

async function handleSetupReset(): Promise<ConfigSetupResetResult> {
  await resetState()
  return {
    action: 'setup_reset',
    state: getState(),
    message: 'Credential state reset to awaiting_setup. Config file deleted.'
  }
}

async function handleSetupComplete(accounts: AccountConfig[]): Promise<ConfigSetupCompleteResult> {
  const previousState = getState()
  const newState = await resolveCredentialState()
  return {
    action: 'setup_complete',
    previous_state: previousState,
    state: newState,
    accounts: newState === 'configured' ? accounts.map((a) => a.email) : []
  }
}

function handleSet(): ConfigSetResult {
  return {
    action: 'set',
    ok: false,
    text: 'email has no runtime settings'
  }
}

function handleCacheClear(): ConfigCacheClearResult {
  const sentCount = clearSentFolderCache()
  const archiveCount = clearArchiveFolderCache()
  _resetTokenCache()
  const cleared = sentCount + archiveCount
  return {
    action: 'cache_clear',
    ok: true,
    cleared
  }
}
