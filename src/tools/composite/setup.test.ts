import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountConfig } from '../helpers/config.js'

// --- Mocks ---
vi.mock('../../credential-state.js', () => ({
  getState: vi.fn(),
  getSetupUrl: vi.fn(),
  triggerRelaySetup: vi.fn(),
  resetState: vi.fn(),
  resolveCredentialState: vi.fn()
}))

import { getSetupUrl, getState, resetState, resolveCredentialState, triggerRelaySetup } from '../../credential-state.js'
import { setup } from './setup.js'

const mockGetState = vi.mocked(getState)
const mockGetSetupUrl = vi.mocked(getSetupUrl)
const mockTriggerRelaySetup = vi.mocked(triggerRelaySetup)
const mockResetState = vi.mocked(resetState)
const mockResolveCredentialState = vi.mocked(resolveCredentialState)

const accounts: AccountConfig[] = [
  {
    id: 'user1_gmail_com',
    email: 'user1@gmail.com',
    password: 'pass1',
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.gmail.com', port: 465, secure: true }
  },
  {
    id: 'user2_outlook_com',
    email: 'user2@outlook.com',
    password: 'pass2',
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
    smtp: { host: 'smtp.office365.com', port: 587, secure: false }
  }
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('setup - status', () => {
  it('returns current state with configured accounts', async () => {
    mockGetState.mockReturnValue('configured')
    mockGetSetupUrl.mockReturnValue(null)

    const result = await setup(accounts, { action: 'status' })

    expect(result).toEqual({
      action: 'status',
      state: 'configured',
      setup_url: null,
      accounts: ['user1@gmail.com', 'user2@outlook.com']
    })
  })

  it('returns setup URL when in setup_in_progress state', async () => {
    mockGetState.mockReturnValue('setup_in_progress')
    mockGetSetupUrl.mockReturnValue('https://relay.example.com/setup/abc123')

    const result = await setup(accounts, { action: 'status' })

    expect(result).toEqual({
      action: 'status',
      state: 'setup_in_progress',
      setup_url: 'https://relay.example.com/setup/abc123',
      accounts: ['user1@gmail.com', 'user2@outlook.com']
    })
  })

  it('returns empty accounts when none configured', async () => {
    mockGetState.mockReturnValue('awaiting_setup')
    mockGetSetupUrl.mockReturnValue(null)

    const result = await setup([], { action: 'status' })

    expect(result).toEqual({
      action: 'status',
      state: 'awaiting_setup',
      setup_url: null,
      accounts: []
    })
  })
})

describe('setup - start', () => {
  it('triggers relay setup and returns URL', async () => {
    mockTriggerRelaySetup.mockResolvedValue('https://relay.example.com/setup/new')
    mockGetState.mockReturnValue('setup_in_progress')

    const result = await setup([], { action: 'start' })

    expect(mockTriggerRelaySetup).toHaveBeenCalledWith({ force: undefined })
    expect(result).toEqual({
      action: 'start',
      state: 'setup_in_progress',
      setup_url: 'https://relay.example.com/setup/new'
    })
  })

  it('passes force flag to triggerRelaySetup', async () => {
    mockTriggerRelaySetup.mockResolvedValue('https://relay.example.com/setup/forced')
    mockGetState.mockReturnValue('setup_in_progress')

    const result = await setup([], { action: 'start', force: true })

    expect(mockTriggerRelaySetup).toHaveBeenCalledWith({ force: true })
    expect(result).toEqual({
      action: 'start',
      state: 'setup_in_progress',
      setup_url: 'https://relay.example.com/setup/forced'
    })
  })

  it('handles null URL when relay is unreachable', async () => {
    mockTriggerRelaySetup.mockResolvedValue(null)
    mockGetState.mockReturnValue('awaiting_setup')

    const result = await setup([], { action: 'start' })

    expect(result).toEqual({
      action: 'start',
      state: 'awaiting_setup',
      setup_url: null
    })
  })
})

describe('setup - reset', () => {
  it('resets state and returns confirmation', async () => {
    mockResetState.mockResolvedValue(undefined)
    mockGetState.mockReturnValue('awaiting_setup')

    const result = await setup(accounts, { action: 'reset' })

    expect(mockResetState).toHaveBeenCalledOnce()
    expect(result).toEqual({
      action: 'reset',
      state: 'awaiting_setup',
      message: 'Credential state reset to awaiting_setup. Config file deleted.'
    })
  })
})

describe('setup - complete', () => {
  it('re-checks and returns configured state with accounts', async () => {
    mockGetState.mockReturnValue('awaiting_setup')
    mockResolveCredentialState.mockResolvedValue('configured')

    const result = await setup(accounts, { action: 'complete' })

    expect(mockResolveCredentialState).toHaveBeenCalledOnce()
    expect(result).toEqual({
      action: 'complete',
      previous_state: 'awaiting_setup',
      state: 'configured',
      accounts: ['user1@gmail.com', 'user2@outlook.com']
    })
  })

  it('returns empty accounts when still not configured', async () => {
    mockGetState.mockReturnValue('setup_in_progress')
    mockResolveCredentialState.mockResolvedValue('awaiting_setup')

    const result = await setup([], { action: 'complete' })

    expect(result).toEqual({
      action: 'complete',
      previous_state: 'setup_in_progress',
      state: 'awaiting_setup',
      accounts: []
    })
  })
})

describe('setup - unknown action', () => {
  it('throws for unknown action', async () => {
    await expect(setup(accounts, { action: 'unknown' as any })).rejects.toThrow('Unknown action: unknown')
  })
})
