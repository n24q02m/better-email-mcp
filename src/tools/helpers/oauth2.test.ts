import { execFile } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:child_process', () => ({
  execFile: vi.fn()
}))

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn()
}))

vi.mock('node:os', () => ({
  homedir: vi.fn().mockReturnValue('/mock/home')
}))

const mockExecFile = vi.mocked(execFile)
const mockReadFile = vi.mocked(readFile)
const mockMkdir = vi.mocked(mkdir)
const mockWriteFile = vi.mocked(writeFile)

import type { OAuth2Tokens } from './oauth2.js'
import {
  _getPendingAuths,
  _resetTokenCache,
  deviceCodeAuth,
  ensureValidToken,
  getClientId,
  isOutlookDomain,
  loadStoredTokens,
  refreshAccessToken,
  saveTokens
} from './oauth2.js'

describe('isOutlookDomain', () => {
  it('returns true for outlook.com', () => {
    expect(isOutlookDomain('user@outlook.com')).toBe(true)
  })

  it('returns true for hotmail.com', () => {
    expect(isOutlookDomain('user@hotmail.com')).toBe(true)
  })

  it('returns true for live.com', () => {
    expect(isOutlookDomain('user@live.com')).toBe(true)
  })

  it('returns false for gmail.com', () => {
    expect(isOutlookDomain('user@gmail.com')).toBe(false)
  })

  it('returns false for invalid email', () => {
    expect(isOutlookDomain('not-an-email')).toBe(false)
  })
})

describe('getClientId', () => {
  it('returns custom client ID from env if set', () => {
    process.env.OUTLOOK_CLIENT_ID = 'custom-cid'
    expect(getClientId()).toBe('custom-cid')
    delete process.env.OUTLOOK_CLIENT_ID
  })

  it('returns default client ID if env not set', () => {
    delete process.env.OUTLOOK_CLIENT_ID
    expect(getClientId()).toBe('d56f8c71-9f7c-43f4-9934-be29cb6e77b0')
  })
})

describe('loadStoredTokens', () => {
  beforeEach(() => {
    _resetTokenCache()
  })

  it('returns tokens for email if file exists and contains entry', async () => {
    const tokens = {
      accessToken: 'at',
      refreshToken: 'rt',
      expiresAt: 123456,
      clientId: 'cid'
    }
    mockReadFile.mockResolvedValue(JSON.stringify({ 'user@outlook.com': tokens }))

    const result = await loadStoredTokens('user@outlook.com')
    expect(result).toEqual(tokens)
  })

  it('returns null if file exists but email not found', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ 'other@outlook.com': {} }))

    const result = await loadStoredTokens('user@outlook.com')
    expect(result).toBeNull()
  })

  it('returns null if file does not exist (ENOENT)', async () => {
    const err = new Error('File not found')
    // @ts-expect-error
    err.code = 'ENOENT'
    mockReadFile.mockRejectedValue(err)

    const result = await loadStoredTokens('user@outlook.com')
    expect(result).toBeNull()
  })

  it('returns null if JSON is corrupted', async () => {
    mockReadFile.mockResolvedValue('not-json')

    const result = await loadStoredTokens('user@outlook.com')
    expect(result).toBeNull()
  })
})

describe('saveTokens', () => {
  beforeEach(() => {
    _resetTokenCache()
    vi.clearAllMocks()
  })

  it('creates directory and writes file with tokens', async () => {
    const tokens: OAuth2Tokens = {
      accessToken: 'at',
      refreshToken: 'rt',
      expiresAt: 1000,
      clientId: 'cid'
    }
    mockReadFile.mockRejectedValue({ code: 'ENOENT' })

    await saveTokens('user@outlook.com', tokens)

    expect(mockMkdir).toHaveBeenCalledWith(expect.stringContaining('.better-email-mcp'), {
      recursive: true,
      mode: 0o700
    })
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('tokens.json'),
      expect.stringContaining('"at"'),
      { mode: 0o600 }
    )
  })

  it('merges with existing tokens on disk', async () => {
    const existing = { 'old@outlook.com': { accessToken: 'old-at' } }
    mockReadFile.mockResolvedValue(JSON.stringify(existing))

    const tokens: OAuth2Tokens = {
      accessToken: 'new-at',
      refreshToken: 'new-rt',
      expiresAt: 2000,
      clientId: 'cid'
    }

    await saveTokens('new@outlook.com', tokens)

    const written = JSON.parse(mockWriteFile.mock.calls[0]![1] as string)
    expect(written['old@outlook.com']).toBeDefined()
    expect(written['new@outlook.com']).toEqual(tokens)
  })
})

describe('refreshAccessToken', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns new tokens on successful refresh', async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({
        access_token: 'new-at',
        refresh_token: 'new-rt',
        expires_in: 3600,
        token_type: 'Bearer'
      })
    })

    const result = await refreshAccessToken('cid', 'old-rt')
    expect(result.access_token).toBe('new-at')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/token'),
      expect.objectContaining({
        method: 'POST',
        body: expect.any(URLSearchParams)
      })
    )
  })

  it('throws error on refresh failure', async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({
        error: 'invalid_grant',
        error_description: 'Token expired'
      })
    })

    await expect(refreshAccessToken('cid', 'bad-rt')).rejects.toThrow('Token refresh failed: Token expired')
  })
})

describe('ensureValidToken', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    _resetTokenCache()
    _getPendingAuths().clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns existing access token if not expired', async () => {
    const now = Math.floor(Date.now() / 1000)
    const account = {
      email: 'user@outlook.com',
      oauth2: {
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: now + 3600,
        clientId: 'cid'
      }
    }

    const token = await ensureValidToken(account)
    expect(token).toBe('at')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('loads tokens from disk if not in memory', async () => {
    const now = Math.floor(Date.now() / 1000)
    const tokens = {
      accessToken: 'disk-at',
      refreshToken: 'disk-rt',
      expiresAt: now + 3600,
      clientId: 'cid'
    }
    mockReadFile.mockResolvedValue(JSON.stringify({ 'user@outlook.com': tokens }))

    const account = { email: 'user@outlook.com' }
    const token = await ensureValidToken(account)

    expect(token).toBe('disk-at')
  })

  it('refreshes token if expired', async () => {
    const now = Math.floor(Date.now() / 1000)
    const account = {
      email: 'user@outlook.com',
      oauth2: {
        accessToken: 'old-at',
        refreshToken: 'old-rt',
        expiresAt: now - 100,
        clientId: 'cid'
      }
    }

    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        access_token: 'refreshed-at',
        expires_in: 3600,
        refresh_token: 'new-rt'
      })
    })

    const token = await ensureValidToken(account)

    expect(token).toBe('refreshed-at')
    expect(account.oauth2.accessToken).toBe('refreshed-at')
    expect(account.oauth2.refreshToken).toBe('new-rt')
    expect(mockWriteFile).toHaveBeenCalled()
  })

  it('initiates device code flow if no tokens exist', async () => {
    mockReadFile.mockRejectedValue({ code: 'ENOENT' })
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        device_code: 'dc-123',
        user_code: 'ABCD-EFGH',
        verification_uri: 'https://microsoft.com/devicelogin',
        expires_in: 900,
        interval: 5
      })
    })

    const account = { email: 'user@outlook.com' }

    await expect(ensureValidToken(account)).rejects.toThrow('Outlook OAuth2 sign-in required')

    expect(_getPendingAuths().has('user@outlook.com')).toBe(true)
    expect(mockExecFile).toHaveBeenCalled()
  })

  it('reuses pending auth flow on subsequent calls', async () => {
    const pending = {
      verificationUri: 'https://uri',
      userCode: 'CODE',
      expiresAt: Date.now() + 100000
    }
    _getPendingAuths().set('user@outlook.com', pending)
    mockReadFile.mockRejectedValue({ code: 'ENOENT' })

    const account = { email: 'user@outlook.com' }
    await expect(ensureValidToken(account)).rejects.toThrow('sign-in in progress')

    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('deviceCodeAuth', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    vi.clearAllMocks()
    _resetTokenCache()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('polls until token is received', async () => {
    let callCount = 0
    mockFetch.mockImplementation(async () => {
      callCount++
      if (callCount === 1) {
        // Device code request
        return {
          json: async () => ({
            device_code: 'dc-123',
            user_code: 'ABCD-EFGH',
            verification_uri: 'https://microsoft.com/devicelogin',
            expires_in: 900,
            interval: 0.01 // Very fast for testing
          })
        }
      }
      if (callCount === 2) {
        // First poll: pending
        return { json: async () => ({ error: 'authorization_pending' }) }
      }
      // Second poll: success
      return {
        json: async () => ({
          access_token: 'final-at',
          refresh_token: 'final-rt',
          expires_in: 3600
        })
      }
    })

    const tokens = await deviceCodeAuth('user@outlook.com', 'cid')

    expect(tokens.accessToken).toBe('final-at')
    expect(mockWriteFile).toHaveBeenCalled()
  })

  it('handles authorization_declined', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        device_code: 'dc-declined',
        user_code: 'DECL-CODE',
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

describe('saveTokens edge cases', () => {
  beforeEach(() => {
    _resetTokenCache()
    vi.clearAllMocks()
  })

  it('starts fresh store if existing token file is corrupted JSON', async () => {
    mockReadFile.mockResolvedValue('not-json')

    const tokens: OAuth2Tokens = {
      accessToken: 'at',
      refreshToken: 'rt',
      expiresAt: 1000,
      clientId: 'cid'
    }

    await saveTokens('user@outlook.com', tokens)

    const written = JSON.parse(mockWriteFile.mock.calls[0]![1] as string)
    expect(written['user@outlook.com']).toEqual(tokens)
    expect(Object.keys(written)).toEqual(['user@outlook.com'])
  })

  it('uses cached token store on subsequent saves', async () => {
    mockReadFile.mockRejectedValue({ code: 'ENOENT' })

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

    await saveTokens('first@outlook.com', tokens1)
    await saveTokens('second@outlook.com', tokens2)

    // Second call to saveTokens should not call readFile again
    expect(mockReadFile).toHaveBeenCalledTimes(1)

    const written = JSON.parse(mockWriteFile.mock.calls[1]![1] as string)
    expect(written['first@outlook.com']).toEqual(tokens1)
    expect(written['second@outlook.com']).toEqual(tokens2)
  })
})

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

    const first = await loadStoredTokens('user@outlook.com')
    expect(first).toEqual(tokens)

    mockReadFile.mockRejectedValue(new Error('should not read again'))
    const second = await loadStoredTokens('user@outlook.com')
    expect(second).toEqual(tokens)
  })
})

describe('openBrowser security', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sanitizes malicious URLs with shell metacharacters', async () => {
    mockReadFile.mockResolvedValue('{}')

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

    const expectedUrl = new URL(maliciousUri).href
    expect(mockExecFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([expectedUrl]),
      expect.any(Function)
    )
  })

  it('blocks non-http/https protocols', async () => {
    mockReadFile.mockResolvedValue('{}')

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

    expect(mockExecFile).not.toHaveBeenCalled()
  })
})
