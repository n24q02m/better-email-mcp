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

vi.mock('./messages.js', () => ({
  clearArchiveFolderCache: vi.fn().mockReturnValue(2)
}))

vi.mock('../helpers/imap-client.js', () => ({
  clearSentFolderCache: vi.fn().mockReturnValue(1)
}))

vi.mock('../helpers/oauth2.js', () => ({
  _resetTokenCache: vi.fn()
}))

import { getSetupUrl, getState, resetState, resolveCredentialState, triggerRelaySetup } from '../../credential-state.js'
import { clearSentFolderCache } from '../helpers/imap-client.js'
import { _resetTokenCache } from '../helpers/oauth2.js'
import { handleConfig } from './config.js'
import { clearArchiveFolderCache } from './messages.js'

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
  vi.mocked(clearArchiveFolderCache).mockReturnValue(2)
  vi.mocked(clearSentFolderCache).mockReturnValue(1)
})

describe('config - status', () => {
  it('returns current state with configured accounts', async () => {
    mockGetState.mockReturnValue('configured')
    mockGetSetupUrl.mockReturnValue(null)

    const result = await handleConfig(accounts, { action: 'status' })

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

    const result = await handleConfig(accounts, { action: 'status' })

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

    const result = await handleConfig([], { action: 'status' })

    expect(result).toEqual({
      action: 'status',
      state: 'awaiting_setup',
      setup_url: null,
      accounts: []
    })
  })
})

describe('config - setup_start', () => {
  it('triggers relay setup and returns URL', async () => {
    mockTriggerRelaySetup.mockResolvedValue('https://relay.example.com/setup/new')
    mockGetState.mockReturnValue('setup_in_progress')

    const result = await handleConfig([], { action: 'setup_start' })

    expect(mockTriggerRelaySetup).toHaveBeenCalledWith({ force: undefined })
    expect(result).toEqual({
      action: 'setup_start',
      state: 'setup_in_progress',
      setup_url: 'https://relay.example.com/setup/new'
    })
  })

  it('passes force flag to triggerRelaySetup', async () => {
    mockTriggerRelaySetup.mockResolvedValue('https://relay.example.com/setup/forced')
    mockGetState.mockReturnValue('setup_in_progress')

    const result = await handleConfig([], { action: 'setup_start', force: true })

    expect(mockTriggerRelaySetup).toHaveBeenCalledWith({ force: true })
    expect(result).toEqual({
      action: 'setup_start',
      state: 'setup_in_progress',
      setup_url: 'https://relay.example.com/setup/forced'
    })
  })

  it('handles null URL when relay is unreachable', async () => {
    mockTriggerRelaySetup.mockResolvedValue(null)
    mockGetState.mockReturnValue('awaiting_setup')

    const result = await handleConfig([], { action: 'setup_start' })

    expect(result).toEqual({
      action: 'setup_start',
      state: 'awaiting_setup',
      setup_url: null
    })
  })
})

describe('config - setup_reset', () => {
  it('resets state and returns confirmation', async () => {
    mockResetState.mockResolvedValue(undefined)
    mockGetState.mockReturnValue('awaiting_setup')

    const result = await handleConfig(accounts, { action: 'setup_reset' })

    expect(mockResetState).toHaveBeenCalledOnce()
    expect(result).toEqual({
      action: 'setup_reset',
      state: 'awaiting_setup',
      message: 'Credential state reset to awaiting_setup. Config file deleted.'
    })
  })
})

describe('config - setup_complete', () => {
  it('re-checks and returns configured state with accounts', async () => {
    mockGetState.mockReturnValue('awaiting_setup')
    mockResolveCredentialState.mockResolvedValue('configured')

    const result = await handleConfig(accounts, { action: 'setup_complete' })

    expect(mockResolveCredentialState).toHaveBeenCalledOnce()
    expect(result).toEqual({
      action: 'setup_complete',
      previous_state: 'awaiting_setup',
      state: 'configured',
      accounts: ['user1@gmail.com', 'user2@outlook.com']
    })
  })

  it('returns empty accounts when still not configured', async () => {
    mockGetState.mockReturnValue('setup_in_progress')
    mockResolveCredentialState.mockResolvedValue('awaiting_setup')

    const result = await handleConfig([], { action: 'setup_complete' })

    expect(result).toEqual({
      action: 'setup_complete',
      previous_state: 'setup_in_progress',
      state: 'awaiting_setup',
      accounts: []
    })
  })
})

describe('config - set', () => {
  it('returns stub indicating email has no runtime settings', async () => {
    const result = await handleConfig(accounts, { action: 'set' })

    expect(result).toEqual({
      action: 'set',
      ok: false,
      text: 'email has no runtime settings'
    })
  })
})

describe('config - cache_clear', () => {
  it('clears all in-memory caches and returns cleared count', async () => {
    const result = await handleConfig(accounts, { action: 'cache_clear' })

    expect(clearSentFolderCache).toHaveBeenCalledOnce()
    expect(clearArchiveFolderCache).toHaveBeenCalledOnce()
    expect(_resetTokenCache).toHaveBeenCalledOnce()
    expect(result).toEqual({
      action: 'cache_clear',
      ok: true,
      cleared: 3 // 1 (sent) + 2 (archive)
    })
  })
})

describe('config - unknown action', () => {
  it('throws for unknown action', async () => {
    await expect(handleConfig(accounts, { action: 'unknown' as any })).rejects.toThrow('Unknown action: unknown')
  })
})
