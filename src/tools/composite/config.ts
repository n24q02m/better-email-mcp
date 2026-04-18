/**
 * Config Tool
 * Unified credential lifecycle + runtime configuration.
 * Replaces the former `setup` tool with canonical name `config`.
 *
 * Setup actions (credential lifecycle):
 *   status, setup_start, setup_reset, setup_complete
 *
 * Runtime config actions:
 *   set, cache_clear
 */

import type { CredentialState } from '../../credential-state.js'
import { getSetupUrl, getState, resetState, resolveCredentialState, triggerRelaySetup } from '../../credential-state.js'
import type { AccountConfig } from '../helpers/config.js'
import { createUnknownActionError, withErrorHandling } from '../helpers/errors.js'
import { clearSentFolderCache } from '../helpers/imap-client.js'
import { _resetTokenCache } from '../helpers/oauth2.js'
import { clearArchiveFolderCache } from './messages.js'

export interface ConfigInput {
  action: 'status' | 'setup_start' | 'setup_reset' | 'setup_complete' | 'set' | 'cache_clear'
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
          'status, setup_start, setup_reset, setup_complete, set, cache_clear'
        )
    }
  })()
}

function handleStatus(accounts: AccountConfig[]): ConfigStatusResult {
  return {
    action: 'status',
    state: getState(),
    setup_url: getSetupUrl(),
    accounts: accounts.map((a) => a.email)
  }
}

async function handleSetupStart(input: ConfigInput): Promise<ConfigSetupStartResult> {
  const url = await triggerRelaySetup({ force: input.force })
  return {
    action: 'setup_start',
    state: getState(),
    setup_url: url
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
