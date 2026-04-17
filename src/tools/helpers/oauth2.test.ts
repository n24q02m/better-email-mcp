import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tryOpenBrowser } from '@n24q02m/mcp-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@n24q02m/mcp-core', () => ({
  tryOpenBrowser: vi.fn().mockResolvedValue(true)
}))

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn()
}))

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn()
}))

vi.mock('node:os', () => ({
  homedir: vi.fn().mockReturnValue('/mock/home')
}))

const mockTryOpenBrowser = vi.mocked(tryOpenBrowser)

import { readFile } from 'node:fs/promises'

const mockReadFile = vi.mocked(readFile)
const mockExistsSync = vi.mocked(existsSync)
const mockReadFileSync = vi.mocked(readFileSync)
const mockWriteFileSync = vi.mocked(writeFileSync)
const mockMkdirSync = vi.mocked(mkdirSync)

beforeEach(() => {
  vi.clearAllMocks()
})

import type { OAuth2Tokens } from './oauth2.js'
import {
  _getPendingAuths,
  _resetBrowserOpenDedupe,
  _resetTokenCache,
  deviceCodeAuth,
  ensureValidToken,
  getClientId,
  initiateOutlookDeviceCode,
  isOutlookDomain,
  loadStoredTokens,
  refreshAccessToken,
  saveTokens
} from './oauth2.js'

// ============================================================================
// isOutlookDomain
// ============================================================================

afterEach(() => {
  _resetTokenCache()
  _resetBrowserOpenDedupe()
})

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

  it('returns bundled default when OUTLOOK_CLIENT_ID is not set', () => {
    delete process.env.OUTLOOK_CLIENT_ID
    expect(getClientId()).toBe('d56f8c71-9f7c-43f4-9934-be29cb6e77b0')
  })
})

// ============================================================================
// loadStoredTokens
// ============================================================================

describe('loadStoredTokens', () => {
  it('returns null when token file does not exist', async () => {
    mockReadFile.mockRejectedValue({ code: 'ENOENT' })

    expect(await loadStoredTokens('user@outlook.com')).toBeNull()
  })

  it('returns tokens for stored email', async () => {
    const tokens: OAuth2Tokens = {
      accessToken: 'at-123',
      refreshToken: 'rt-456',
      expiresAt: 9999999999,
      clientId: 'client-789'
    }
    mockReadFile.mockResolvedValue(JSON.stringify({ 'user@outlook.com': tokens }))

    expect(await loadStoredTokens('user@outlook.com')).toEqual(tokens)
  })

  it('returns null for email not in store', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ 'other@outlook.com': {} }))

    expect(await loadStoredTokens('user@outlook.com')).toBeNull()
  })

  it('normalizes email to lowercase', async () => {
    const tokens: OAuth2Tokens = {
      accessToken: 'at',
      refreshToken: 'rt',
      expiresAt: 0,
      clientId: 'c'
    }
    mockReadFile.mockResolvedValue(JSON.stringify({ 'user@outlook.com': tokens }))

    expect(await loadStoredTokens('User@Outlook.com')).toEqual(tokens)
  })

  it('returns null on JSON parse error', async () => {
    mockReadFile.mockResolvedValue('invalid json{')

    expect(await loadStoredTokens('user@outlook.com')).toBeNull()
  })
})

// ============================================================================
// saveTokens
// ============================================================================

describe('saveTokens', () => {
  beforeEach(() => {
    _resetTokenCache()
  })

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
    mockReadFile.mockResolvedValue('{}')
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

  it('loads tokens from disk when not in memory', async () => {
    const stored: OAuth2Tokens = {
      accessToken: 'disk-token',
      refreshToken: 'disk-rt',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      clientId: 'cid'
    }
    mockReadFile.mockResolvedValue(JSON.stringify({ 'user@outlook.com': stored }))

    const account = { email: 'user@outlook.com' } as { email: string; oauth2?: OAuth2Tokens }
    const token = await ensureValidToken(account)

    expect(token).toBe('disk-token')
    expect(account.oauth2).toEqual(stored)
  })

  it('initiates Device Code flow when no tokens exist', async () => {
    // No tokens on disk
    mockReadFileSync.mockReturnValue('{}')

    // Mock device code request
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        device_code: 'dc-auto',
        user_code: 'AUTO-CODE',
        verification_uri: 'https://microsoft.com/devicelogin',
        expires_in: 900,
        interval: 5
      })
    })

    const account = { email: 'user@outlook.com' } as { email: string; oauth2?: OAuth2Tokens }

    await expect(ensureValidToken(account)).rejects.toThrow('AUTO-CODE')
    await expect(ensureValidToken(account)).rejects.toThrow('microsoft.com/devicelogin')

    // Clean up pending auth
    _getPendingAuths().clear()
  })

  it('opens browser when initiating Device Code flow', async () => {
    mockReadFileSync.mockReturnValue('{}')

    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        device_code: 'dc-browser',
        user_code: 'BROWSER-CODE',
        verification_uri: 'https://microsoft.com/devicelogin',
        expires_in: 900,
        interval: 5
      })
    })

    const account = { email: 'browser@outlook.com' } as { email: string; oauth2?: OAuth2Tokens }

    await expect(ensureValidToken(account)).rejects.toThrow('BROWSER-CODE')

    // Verify mcp-core's tryOpenBrowser was called with the verification URI
    expect(mockTryOpenBrowser).toHaveBeenCalledTimes(1)
    expect(mockTryOpenBrowser).toHaveBeenCalledWith('https://microsoft.com/devicelogin')

    _getPendingAuths().clear()
  })

  it('does not open browser on retry (reuses pending auth)', async () => {
    mockReadFileSync.mockReturnValue('{}')

    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        device_code: 'dc-nodup',
        user_code: 'NODUP-CODE',
        verification_uri: 'https://microsoft.com/devicelogin',
        expires_in: 900,
        interval: 5
      })
    })

    const account = { email: 'nodup@outlook.com' } as { email: string; oauth2?: OAuth2Tokens }

    // First call: opens browser via mcp-core
    await expect(ensureValidToken(account)).rejects.toThrow('NODUP-CODE')
    expect(mockTryOpenBrowser).toHaveBeenCalledTimes(1)

    // Second call: reuses pending auth, oauth2.ts short-circuits before
    // calling tryOpenBrowser, so mcp-core helper is not invoked again.
    mockTryOpenBrowser.mockClear()
    await expect(ensureValidToken(account)).rejects.toThrow('NODUP-CODE')
    expect(mockTryOpenBrowser).not.toHaveBeenCalled()

    _getPendingAuths().clear()
  })

  it('reuses pending auth code on retry', async () => {
    mockReadFileSync.mockReturnValue('{}')

    // First call: device code request
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        device_code: 'dc-1',
        user_code: 'FIRST-CODE',
        verification_uri: 'https://microsoft.com/devicelogin',
        expires_in: 900,
        interval: 5
      })
    })

    const account = { email: 'retry@outlook.com' } as { email: string; oauth2?: OAuth2Tokens }

    // First call initiates flow
    await expect(ensureValidToken(account)).rejects.toThrow('FIRST-CODE')

    // Second call should reuse same code, no new fetch
    const fetchCountBefore = mockFetch.mock.calls.length
    await expect(ensureValidToken(account)).rejects.toThrow('FIRST-CODE')
    // No additional device code fetch (only background poll may have fired)
    expect(mockFetch.mock.calls.length - fetchCountBefore).toBeLessThanOrEqual(1)

    _getPendingAuths().clear()
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

  it('handles slow_down response by increasing poll interval', async () => {
    let callCount = 0
    mockFetch.mockImplementation(async () => {
      callCount++
      if (callCount === 1) {
        // Device code request
        return {
          json: async () => ({
            device_code: 'dc-slow',
            user_code: 'SLOW-CODE',
            verification_uri: 'https://microsoft.com/devicelogin',
            expires_in: 900,
            interval: 0.01
          })
        }
      }
      if (callCount === 2) {
        // First poll: slow_down
        return { json: async () => ({ error: 'slow_down' }) }
      }
      // Subsequent polls: success
      return {
        json: async () => ({
          access_token: 'at-after-slow',
          refresh_token: 'rt-after-slow',
          expires_in: 3600
        })
      }
    })

    const tokens = await deviceCodeAuth('slow@outlook.com', 'cid')

    expect(tokens.accessToken).toBe('at-after-slow')
    expect(callCount).toBeGreaterThanOrEqual(3)
  }, 15_000)

  it('uses default client ID when none provided', async () => {
    delete process.env.OUTLOOK_CLIENT_ID

    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        device_code: 'dc-default',
        user_code: 'DEFAULT-CODE',
        verification_uri: 'https://microsoft.com/devicelogin',
        expires_in: 900,
        interval: 0.01
      })
    })

    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        access_token: 'at-default',
        refresh_token: 'rt-default',
        expires_in: 3600
      })
    })

    const tokens = await deviceCodeAuth('user@outlook.com')

    expect(tokens.clientId).toBe('d56f8c71-9f7c-43f4-9934-be29cb6e77b0')
  })

  it('throws on device code request with no user_code', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        device_code: 'dc',
        verification_uri: 'https://microsoft.com/devicelogin',
        expires_in: 900,
        interval: 5
        // No user_code
      })
    })

    await expect(deviceCodeAuth('user@outlook.com', 'cid')).rejects.toThrow('Device code request failed')
  })

  it('throws on device code request with error but no description', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        error: 'server_error'
      })
    })

    await expect(deviceCodeAuth('user@outlook.com', 'cid')).rejects.toThrow('server_error')
  })

  it('throws on other token error without error_description', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        device_code: 'dc-badcode',
        user_code: 'BAD-CODE',
        verification_uri: 'https://microsoft.com/devicelogin',
        expires_in: 900,
        interval: 0.01
      })
    })

    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        error: 'bad_verification_code'
      })
    })

    await expect(deviceCodeAuth('bad@outlook.com', 'cid')).rejects.toThrow('bad_verification_code')
  })
})

// ============================================================================
// saveTokens edge cases
// ============================================================================

describe('saveTokens edge cases', () => {
  beforeEach(() => {
    _resetTokenCache()
    vi.clearAllMocks()
  })

  it('starts fresh store if existing token file is corrupted JSON', () => {
    mockExistsSync.mockImplementation((path) => {
      if (String(path).endsWith('tokens.json')) return true
      return true // config dir exists
    })
    mockReadFileSync.mockImplementation(() => {
      throw new SyntaxError('Unexpected token')
    })

    const tokens: OAuth2Tokens = {
      accessToken: 'at',
      refreshToken: 'rt',
      expiresAt: 1000,
      clientId: 'cid'
    }

    saveTokens('user@outlook.com', tokens)

    const written = JSON.parse(mockWriteFileSync.mock.calls[0]![1] as string)
    expect(written['user@outlook.com']).toEqual(tokens)
    // Should only have the new token, not corrupted data
    expect(Object.keys(written)).toEqual(['user@outlook.com'])
  })

  it('uses cached token store on subsequent saves', () => {
    mockExistsSync.mockReturnValue(false)

    const tokens1: OAuth2Tokens = {
      accessToken: 'at1',
      refreshToken: 'rt1',
      expiresAt: 1000,
      clientId: 'cid'
    }
    const tokens2: OAuth2Tokens = {
      accessToken: 'at2',
      refreshToken: 'rt2',
      expiresAt: 2000,
      clientId: 'cid'
    }

    // First save populates cache
    saveTokens('first@outlook.com', tokens1)
    // Second save should use cache, not read from disk
    saveTokens('second@outlook.com', tokens2)

    // readFileSync should NOT be called for second save (cache is used)
    const written = JSON.parse(mockWriteFileSync.mock.calls[1]![1] as string)
    expect(written['first@outlook.com']).toEqual(tokens1)
    expect(written['second@outlook.com']).toEqual(tokens2)
  })
})

// ============================================================================
// loadStoredTokens with cached store
// ============================================================================

describe('loadStoredTokens cached', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses cached store on subsequent loads', async () => {
    _resetTokenCache()
    const tokens: OAuth2Tokens = {
      accessToken: 'cached-at',
      refreshToken: 'cached-rt',
      expiresAt: 9999999999,
      clientId: 'cached-cid'
    }
    mockReadFile.mockResolvedValue(JSON.stringify({ 'user@outlook.com': tokens }))

    // First load reads from file
    const first = await loadStoredTokens('user@outlook.com')
    expect(first).toEqual(tokens)

    // Second load should use cache
    mockReadFile.mockRejectedValue(new Error('should not read again'))
    const second = await loadStoredTokens('user@outlook.com')
    expect(second).toEqual(tokens)
  })
})

// ============================================================================
// refreshAccessToken edge cases
// ============================================================================

describe('refreshAccessToken edge cases', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('throws with error code when no error_description', async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({
        error: 'invalid_grant'
      })
    })

    await expect(refreshAccessToken('cid', 'bad-rt')).rejects.toThrow('invalid_grant')
  })
})

// ============================================================================
// Browser open delegation (mcp-core owns URL sanitization + platform exec)
// ============================================================================

describe('openBrowser delegates to mcp-core', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('forwards malicious URLs with shell metacharacters to mcp-core', async () => {
    mockReadFileSync.mockReturnValue('{}')

    const maliciousUri = 'https://microsoft.com/devicelogin?code=ABCD;echo"vulnerable"'
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        device_code: 'dc-sec',
        user_code: 'SEC-CODE',
        verification_uri: maliciousUri,
        expires_in: 900,
        interval: 5
      })
    })

    const account = { email: 'sec@outlook.com' } as { email: string; oauth2?: OAuth2Tokens }

    await expect(ensureValidToken(account)).rejects.toThrow('SEC-CODE')

    // mcp-core's tryOpenBrowser is responsible for URL canonicalisation and
    // shell-injection protection (it uses execFile with argument arrays).
    // This test ensures oauth2.ts forwards the raw URL without tampering.
    expect(mockTryOpenBrowser).toHaveBeenCalledWith(maliciousUri)

    _getPendingAuths().clear()
  })

  it('forwards non-http/https protocols to mcp-core (which rejects them)', async () => {
    mockReadFileSync.mockReturnValue('{}')

    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        device_code: 'dc-proto',
        user_code: 'PROTO-CODE',
        verification_uri: 'javascript:alert(1)',
        expires_in: 900,
        interval: 5
      })
    })

    const account = { email: 'proto@outlook.com' } as { email: string; oauth2?: OAuth2Tokens }

    await expect(ensureValidToken(account)).rejects.toThrow('PROTO-CODE')

    // mcp-core.tryOpenBrowser is covered by its own tests for protocol
    // filtering — we only verify oauth2.ts delegated the call.
    expect(mockTryOpenBrowser).toHaveBeenCalledWith('javascript:alert(1)')

    _getPendingAuths().clear()
  })

  it('forwards URLs with leading hyphens to mcp-core', async () => {
    mockReadFileSync.mockReturnValue('{}')

    const hyphenUri = 'https://-example.com'
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        device_code: 'dc-hyphen',
        user_code: 'HYPHEN-CODE',
        verification_uri: hyphenUri,
        expires_in: 900,
        interval: 5
      })
    })

    const account = { email: 'hyphen@outlook.com' } as { email: string; oauth2?: OAuth2Tokens }

    await expect(ensureValidToken(account)).rejects.toThrow('HYPHEN-CODE')

    expect(mockTryOpenBrowser).toHaveBeenCalledWith(hyphenUri)

    _getPendingAuths().clear()
  })
})

// ============================================================================
// initiateOutlookDeviceCode (L2.12d)
// ============================================================================

describe('initiateOutlookDeviceCode', () => {
  const mockFetch = vi.fn()
  const originalEnv = process.env.OUTLOOK_CLIENT_ID

  beforeEach(() => {
    mockFetch.mockReset()
    vi.stubGlobal('fetch', mockFetch)
    process.env.OUTLOOK_CLIENT_ID = 'test-client-id'
    mockExistsSync.mockReturnValue(false)
    _getPendingAuths().clear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    if (originalEnv) {
      process.env.OUTLOOK_CLIENT_ID = originalEnv
    } else {
      delete process.env.OUTLOOK_CLIENT_ID
    }
    _getPendingAuths().clear()
    vi.restoreAllMocks()
  })

  it('requests device code and returns verification URI + user code', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        device_code: 'dc-new',
        user_code: 'FRESH-123',
        verification_uri: 'https://microsoft.com/devicelogin',
        expires_in: 900,
        interval: 9999 // Large interval so background poll never fires in test.
      })
    })

    const result = await initiateOutlookDeviceCode('new@outlook.com')

    expect(result.verificationUri).toBe('https://microsoft.com/devicelogin')
    expect(result.userCode).toBe('FRESH-123')
    expect(result.expiresIn).toBe(900)
    // Pending auth cached so reused on retry.
    expect(_getPendingAuths().get('new@outlook.com')).toBeDefined()
  })

  it('reuses existing pending auth on retry (no new device code request)', async () => {
    _getPendingAuths().set('existing@outlook.com', {
      verificationUri: 'https://microsoft.com/devicelogin',
      userCode: 'CACHED-777',
      expiresAt: Date.now() + 600_000
    })

    const result = await initiateOutlookDeviceCode('existing@outlook.com')

    expect(result.userCode).toBe('CACHED-777')
    expect(result.verificationUri).toBe('https://microsoft.com/devicelogin')
    // No HTTP call when reusing cached pending auth.
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('invokes onComplete callback when background poll succeeds', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        device_code: 'dc-cb',
        user_code: 'CB-123',
        verification_uri: 'https://microsoft.com/devicelogin',
        expires_in: 900,
        interval: 0.01 // Fast poll for test.
      })
    })
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        access_token: 'at-ok',
        refresh_token: 'rt-ok',
        expires_in: 3600
      })
    })

    const onComplete = vi.fn()
    await initiateOutlookDeviceCode('cb@outlook.com', onComplete)

    // Allow background poll to run and fire the callback.
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(onComplete).toHaveBeenCalled()
    // Tokens persisted to disk.
    expect(mockWriteFileSync).toHaveBeenCalled()
  })

  it('throws descriptive error when Microsoft rejects the device code request', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        error: 'invalid_client',
        error_description: 'Unknown client ID'
      })
    })

    await expect(initiateOutlookDeviceCode('bad@outlook.com')).rejects.toThrow('Unknown client ID')
  })
})
