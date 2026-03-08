import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn()
}))

vi.mock('node:os', () => ({
  homedir: vi.fn().mockReturnValue('/mock/home')
}))

const mockExistsSync = vi.mocked(existsSync)
const mockReadFileSync = vi.mocked(readFileSync)
const mockWriteFileSync = vi.mocked(writeFileSync)
const mockMkdirSync = vi.mocked(mkdirSync)

beforeEach(() => {
  vi.clearAllMocks()
})

import type { OAuth2Tokens } from './oauth2.js'
import {
  deviceCodeAuth,
  ensureValidToken,
  getClientId,
  isOutlookDomain,
  loadStoredTokens,
  refreshAccessToken,
  saveTokens
} from './oauth2.js'

// ============================================================================
// isOutlookDomain
// ============================================================================

describe('isOutlookDomain', () => {
  it('detects outlook.com', () => {
    expect(isOutlookDomain('user@outlook.com')).toBe(true)
  })

  it('detects hotmail.com', () => {
    expect(isOutlookDomain('user@hotmail.com')).toBe(true)
  })

  it('detects live.com', () => {
    expect(isOutlookDomain('user@live.com')).toBe(true)
  })

  it('rejects gmail.com', () => {
    expect(isOutlookDomain('user@gmail.com')).toBe(false)
  })

  it('rejects yahoo.com', () => {
    expect(isOutlookDomain('user@yahoo.com')).toBe(false)
  })

  it('handles empty string', () => {
    expect(isOutlookDomain('')).toBe(false)
  })

  it('handles email without domain', () => {
    expect(isOutlookDomain('nodomain')).toBe(false)
  })

  it('is case-insensitive via domain extraction', () => {
    expect(isOutlookDomain('user@OUTLOOK.COM')).toBe(true)
  })
})

// ============================================================================
// getClientId
// ============================================================================

describe('getClientId', () => {
  const originalEnv = process.env.OUTLOOK_CLIENT_ID

  afterEach(() => {
    if (originalEnv) {
      process.env.OUTLOOK_CLIENT_ID = originalEnv
    } else {
      delete process.env.OUTLOOK_CLIENT_ID
    }
  })

  it('returns OUTLOOK_CLIENT_ID from env', () => {
    process.env.OUTLOOK_CLIENT_ID = 'test-client-id-123'
    expect(getClientId()).toBe('test-client-id-123')
  })

  it('throws when OUTLOOK_CLIENT_ID is not set', () => {
    delete process.env.OUTLOOK_CLIENT_ID
    expect(() => getClientId()).toThrow('OUTLOOK_CLIENT_ID')
  })
})

// ============================================================================
// loadStoredTokens
// ============================================================================

describe('loadStoredTokens', () => {
  it('returns null when token file does not exist', () => {
    mockExistsSync.mockReturnValue(false)

    expect(loadStoredTokens('user@outlook.com')).toBeNull()
  })

  it('returns tokens for stored email', () => {
    const tokens: OAuth2Tokens = {
      accessToken: 'at-123',
      refreshToken: 'rt-456',
      expiresAt: 9999999999,
      clientId: 'client-789'
    }
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(JSON.stringify({ 'user@outlook.com': tokens }))

    expect(loadStoredTokens('user@outlook.com')).toEqual(tokens)
  })

  it('returns null for email not in store', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(JSON.stringify({ 'other@outlook.com': {} }))

    expect(loadStoredTokens('user@outlook.com')).toBeNull()
  })

  it('normalizes email to lowercase', () => {
    const tokens: OAuth2Tokens = {
      accessToken: 'at',
      refreshToken: 'rt',
      expiresAt: 0,
      clientId: 'c'
    }
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(JSON.stringify({ 'user@outlook.com': tokens }))

    expect(loadStoredTokens('User@Outlook.com')).toEqual(tokens)
  })

  it('returns null on JSON parse error', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('invalid json{')

    expect(loadStoredTokens('user@outlook.com')).toBeNull()
  })
})

// ============================================================================
// saveTokens
// ============================================================================

describe('saveTokens', () => {
  const tokens: OAuth2Tokens = {
    accessToken: 'at',
    refreshToken: 'rt',
    expiresAt: 1000,
    clientId: 'cid'
  }

  it('creates config directory if not exists', () => {
    mockExistsSync.mockImplementation((path) => {
      if (String(path).endsWith('tokens.json')) return false
      return false // config dir doesn't exist
    })

    saveTokens('user@outlook.com', tokens)

    expect(mockMkdirSync).toHaveBeenCalledWith(expect.stringContaining('.better-email-mcp'), {
      recursive: true,
      mode: 0o700
    })
  })

  it('writes tokens with 0600 permissions', () => {
    mockExistsSync.mockReturnValue(false)

    saveTokens('user@outlook.com', tokens)

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining('tokens.json'),
      expect.stringContaining('"user@outlook.com"'),
      { mode: 0o600 }
    )
  })

  it('merges with existing tokens', () => {
    const existing = { 'other@hotmail.com': { accessToken: 'old', refreshToken: 'old', expiresAt: 0, clientId: 'c' } }

    mockExistsSync.mockImplementation((path) => {
      if (String(path).endsWith('tokens.json')) return true
      return true
    })
    mockReadFileSync.mockReturnValue(JSON.stringify(existing))

    saveTokens('user@outlook.com', tokens)

    const written = JSON.parse(mockWriteFileSync.mock.calls[0]![1] as string)
    expect(written['other@hotmail.com']).toBeDefined()
    expect(written['user@outlook.com']).toEqual(tokens)
  })

  it('normalizes email to lowercase', () => {
    mockExistsSync.mockReturnValue(false)

    saveTokens('User@OUTLOOK.com', tokens)

    const written = JSON.parse(mockWriteFileSync.mock.calls[0]![1] as string)
    expect(written['user@outlook.com']).toEqual(tokens)
  })
})

// ============================================================================
// refreshAccessToken
// ============================================================================

describe('refreshAccessToken', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends correct refresh token request', async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({
        access_token: 'new-at',
        refresh_token: 'new-rt',
        expires_in: 3600,
        token_type: 'Bearer'
      })
    })

    const result = await refreshAccessToken('client-id', 'old-refresh-token')

    expect(result.access_token).toBe('new-at')
    expect(result.refresh_token).toBe('new-rt')
    expect(result.expires_in).toBe(3600)

    // Verify the request parameters
    const [url, options] = mockFetch.mock.calls[0]!
    expect(url).toContain('/oauth2/v2.0/token')
    const body = options.body as URLSearchParams
    expect(body.get('client_id')).toBe('client-id')
    expect(body.get('grant_type')).toBe('refresh_token')
    expect(body.get('refresh_token')).toBe('old-refresh-token')
  })

  it('throws on error response', async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({
        error: 'invalid_grant',
        error_description: 'Refresh token expired'
      })
    })

    await expect(refreshAccessToken('cid', 'expired-rt')).rejects.toThrow('Refresh token expired')
  })
})

// ============================================================================
// ensureValidToken
// ============================================================================

describe('ensureValidToken', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('{}')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns existing token when not expired', async () => {
    const account = {
      email: 'user@outlook.com',
      oauth2: {
        accessToken: 'valid-token',
        refreshToken: 'rt',
        expiresAt: Math.floor(Date.now() / 1000) + 3600, // 1h from now
        clientId: 'cid'
      }
    }

    const token = await ensureValidToken(account)

    expect(token).toBe('valid-token')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('refreshes when token is about to expire (within 5min buffer)', async () => {
    const account = {
      email: 'user@outlook.com',
      oauth2: {
        accessToken: 'old-token',
        refreshToken: 'rt',
        expiresAt: Math.floor(Date.now() / 1000) + 60, // Only 1 min left
        clientId: 'cid'
      }
    }

    mockFetch.mockResolvedValue({
      json: async () => ({
        access_token: 'new-token',
        refresh_token: 'new-rt',
        expires_in: 3600
      })
    })

    const token = await ensureValidToken(account)

    expect(token).toBe('new-token')
    expect(account.oauth2.accessToken).toBe('new-token')
    expect(account.oauth2.refreshToken).toBe('new-rt')
  })

  it('refreshes when token is already expired', async () => {
    const account = {
      email: 'user@outlook.com',
      oauth2: {
        accessToken: 'expired-token',
        refreshToken: 'rt',
        expiresAt: Math.floor(Date.now() / 1000) - 100, // Already expired
        clientId: 'cid'
      }
    }

    mockFetch.mockResolvedValue({
      json: async () => ({
        access_token: 'fresh-token',
        refresh_token: 'fresh-rt',
        expires_in: 3600
      })
    })

    const token = await ensureValidToken(account)

    expect(token).toBe('fresh-token')
  })

  it('persists refreshed tokens to disk', async () => {
    const account = {
      email: 'user@outlook.com',
      oauth2: {
        accessToken: 'old',
        refreshToken: 'old-rt',
        expiresAt: 0,
        clientId: 'cid'
      }
    }

    mockFetch.mockResolvedValue({
      json: async () => ({
        access_token: 'new',
        refresh_token: 'new-rt',
        expires_in: 3600
      })
    })

    await ensureValidToken(account)

    expect(mockWriteFileSync).toHaveBeenCalled()
  })

  it('throws when no oauth2 tokens', async () => {
    const account = { email: 'user@outlook.com' }

    await expect(ensureValidToken(account)).rejects.toThrow('No OAuth2 tokens')
  })

  it('keeps old refresh token if new one not provided', async () => {
    const account = {
      email: 'user@outlook.com',
      oauth2: {
        accessToken: 'old',
        refreshToken: 'keep-this-rt',
        expiresAt: 0,
        clientId: 'cid'
      }
    }

    mockFetch.mockResolvedValue({
      json: async () => ({
        access_token: 'new',
        expires_in: 3600
        // no refresh_token in response
      })
    })

    await ensureValidToken(account)

    expect(account.oauth2.refreshToken).toBe('keep-this-rt')
  })
})

// ============================================================================
// deviceCodeAuth
// ============================================================================

describe('deviceCodeAuth', () => {
  const mockFetch = vi.fn()
  const originalEnv = process.env.OUTLOOK_CLIENT_ID

  beforeEach(() => {
    mockFetch.mockReset()
    vi.stubGlobal('fetch', mockFetch)
    process.env.OUTLOOK_CLIENT_ID = 'test-client-id'
    mockExistsSync.mockReturnValue(false)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    if (originalEnv) {
      process.env.OUTLOOK_CLIENT_ID = originalEnv
    } else {
      delete process.env.OUTLOOK_CLIENT_ID
    }
    vi.restoreAllMocks()
  })

  it('completes Device Code flow successfully', async () => {
    // First call: device code request
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        device_code: 'dc-123',
        user_code: 'ABCD-EFGH',
        verification_uri: 'https://microsoft.com/devicelogin',
        expires_in: 900,
        interval: 0.01 // Fast poll for test
      })
    })

    // Second call: token response (success immediately)
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        access_token: 'at-success',
        refresh_token: 'rt-success',
        expires_in: 3600,
        token_type: 'Bearer'
      })
    })

    const tokens = await deviceCodeAuth('user@outlook.com', 'test-client-id')

    expect(tokens.accessToken).toBe('at-success')
    expect(tokens.refreshToken).toBe('rt-success')
    expect(tokens.clientId).toBe('test-client-id')
    expect(mockWriteFileSync).toHaveBeenCalled() // Tokens saved
  })

  it('polls until authorization is granted', async () => {
    // Device code request
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        device_code: 'dc-123',
        user_code: 'CODE',
        verification_uri: 'https://microsoft.com/devicelogin',
        expires_in: 900,
        interval: 0.01
      })
    })

    // First poll: pending
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ error: 'authorization_pending' })
    })

    // Second poll: success
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        access_token: 'at',
        refresh_token: 'rt',
        expires_in: 3600
      })
    })

    const tokens = await deviceCodeAuth('user@outlook.com', 'cid')

    expect(tokens.accessToken).toBe('at')
    // 3 fetch calls: device code request + pending poll + success poll
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('throws on device code request failure', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        error: 'invalid_client',
        error_description: 'Client ID not found'
      })
    })

    await expect(deviceCodeAuth('user@outlook.com', 'bad-id')).rejects.toThrow('Client ID not found')
  })

  it('throws on authorization declined', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        device_code: 'dc',
        user_code: 'CODE',
        verification_uri: 'https://microsoft.com/devicelogin',
        expires_in: 900,
        interval: 0.01
      })
    })

    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        error: 'authorization_declined',
        error_description: 'User declined'
      })
    })

    await expect(deviceCodeAuth('user@outlook.com', 'cid')).rejects.toThrow('User declined')
  })
})
