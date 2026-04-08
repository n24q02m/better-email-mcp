/**
 * Setup Tool
 * Manage credential state, trigger relay setup, reset, and re-check configuration.
 */

import type { CredentialState } from '../../credential-state.js'
import { getSetupUrl, getState, resetState, resolveCredentialState, triggerRelaySetup } from '../../credential-state.js'
import type { AccountConfig } from '../helpers/config.js'
import { createUnknownActionError, withErrorHandling } from '../helpers/errors.js'

export interface SetupInput {
  action: 'status' | 'start' | 'reset' | 'complete'
  force?: boolean
}

interface SetupStatusResult {
  action: 'status'
  state: CredentialState
  setup_url: string | null
  accounts: string[]
}

interface SetupStartResult {
  action: 'start'
  state: CredentialState
  setup_url: string | null
}

interface SetupResetResult {
  action: 'reset'
  state: CredentialState
  message: string
}

interface SetupCompleteResult {
  action: 'complete'
  previous_state: CredentialState
  state: CredentialState
  accounts: string[]
}

type SetupResult = SetupStatusResult | SetupStartResult | SetupResetResult | SetupCompleteResult

/**
 * Unified setup tool - manages credential lifecycle
 */
export async function setup(accounts: AccountConfig[], input: SetupInput): Promise<SetupResult> {
  return withErrorHandling(async () => {
    switch (input.action) {
      case 'status':
        return handleStatus(accounts)

      case 'start':
        return await handleStart(input)

      case 'reset':
        return await handleReset()

      case 'complete':
        return await handleComplete(accounts)

      default:
        throw createUnknownActionError(input.action, 'status, start, reset, complete')
    }
  })()
}

function handleStatus(accounts: AccountConfig[]): SetupStatusResult {
  return {
    action: 'status',
    state: getState(),
    setup_url: getSetupUrl(),
    accounts: accounts.map((a) => a.email)
  }
}

async function handleStart(input: SetupInput): Promise<SetupStartResult> {
  const url = await triggerRelaySetup({ force: input.force })
  return {
    action: 'start',
    state: getState(),
    setup_url: url
  }
}

async function handleReset(): Promise<SetupResetResult> {
  await resetState()
  return {
    action: 'reset',
    state: getState(),
    message: 'Credential state reset to awaiting_setup. Config file deleted.'
  }
}

async function handleComplete(accounts: AccountConfig[]): Promise<SetupCompleteResult> {
  const previousState = getState()
  const newState = await resolveCredentialState()
  return {
    action: 'complete',
    previous_state: previousState,
    state: newState,
    accounts: newState === 'configured' ? accounts.map((a) => a.email) : []
  }
}
