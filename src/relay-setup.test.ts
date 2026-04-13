import { existsSync, readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureConfig, formatCredentials } from './relay-setup.js'

// Mock node:fs for checkSavedOAuthTokens
vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn()
}))

// Mock mcp-relay-core modules
vi.mock('@n24q02m/mcp-relay-core/storage', () => ({
  resolveConfig: vi.fn()
}))
vi.mock('@n24q02m/mcp-relay-core/relay', () => ({
  createSession: vi.fn(),
  pollForResult: vi.fn()
}))
vi.mock('@n24q02m/mcp-relay-core', () => ({
  writeConfig: vi.fn().mockResolvedValue(undefined)
}))

// Mock parseCredentials and isOutlookDomain for post-relay code
vi.mock('./tools/helpers/config.js', () => ({
  parseCredentials: vi.fn().mockResolvedValue([])
}))
vi.mock('./tools/helpers/oauth2.js', () => ({
  ensureValidToken: vi.fn(),
  isOutlookDomain: vi.fn().mockReturnValue(false)
}))

import { writeConfig } from '@n24q02m/mcp-relay-core'
import { createSession, pollForResult } from '@n24q02m/mcp-relay-core/relay'
// Import after mocks
import { resolveConfig } from '@n24q02m/mcp-relay-core/storage'
import { parseCredentials } from './tools/helpers/config.js'
import { ensureValidToken, isOutlookDomain } from './tools/helpers/oauth2.js'

const mockExistsSync = vi.mocked(existsSync)
const mockReadFileSync = vi.mocked(readFileSync)

describe('formatCredentials', () => {
  it('formats email:password when no imap_host', () => {
    const result = formatCredentials({ email: 'user@gmail.com', password: 'secret123' })
    expect(result).toBe('user@gmail.com:secret123')
  })

  it('formats email:password:imap_host when imap_host is present', () => {
    const result = formatCredentials({
      email: 'user@custom.com',
      password: 'pass',
      imap_host: 'imap.custom.com'
    })
    expect(result).toBe('user@custom.com:pass:imap.custom.com')
  })

  it('throws when email is missing', () => {
    expect(() => formatCredentials({ password: 'pass' })).toThrow('missing required fields')
  })

  it('throws when password is missing', () => {
    expect(() => formatCredentials({ email: 'user@gmail.com' })).toThrow('missing required fields')
  })

  it('handles passwords containing colons', () => {
    const result = formatCredentials({ email: 'user@gmail.com', password: 'pass:with:colons' })
    expect(result).toBe('user@gmail.com:pass:with:colons')
  })

  it('returns EMAIL_CREDENTIALS directly when present', () => {
    const result = formatCredentials({ EMAIL_CREDENTIALS: 'a@b.com:pass1,c@d.com:pass2' })
    expect(result).toBe('a@b.com:pass1,c@d.com:pass2')
  })
})

describe('ensureConfig', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns formatted credentials from config file', async () => {
    vi.mocked(resolveConfig).mockResolvedValue({
      config: { EMAIL_CREDENTIALS: 'user@gmail.com:app-pass' },
      source: 'file'
    })

    const result = await ensureConfig()

    expect(result).toBe('user@gmail.com:app-pass')
    expect(resolveConfig).toHaveBeenCalledWith('better-email-mcp', ['EMAIL_CREDENTIALS'])
    expect(createSession).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('loaded from file'))
  })

  it('returns formatted credentials with legacy format from config file', async () => {
    vi.mocked(resolveConfig).mockResolvedValue({
      config: { email: 'user@custom.com', password: 'pass', imap_host: 'imap.custom.com' },
      source: 'file'
    })

    const result = await ensureConfig()

    expect(result).toBe('user@custom.com:pass:imap.custom.com')
  })

  it('returns saved OAuth2 tokens when config file is empty', async () => {
    vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: null })

    // Mock checkSavedOAuthTokens: existsSync returns true, readFileSync returns token store
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        'user@outlook.com': { accessToken: 'at', refreshToken: 'rt', expiresAt: 999999, clientId: 'cid' },
        'other@hotmail.com': { accessToken: 'at2', refreshToken: 'rt2', expiresAt: 999999, clientId: 'cid2' }
      })
    )

    const result = await ensureConfig()

    expect(result).toBe('user@outlook.com:oauth2,other@hotmail.com:oauth2')
    expect(createSession).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Found saved OAuth2 tokens'))
  })

  it('skips non-email keys in saved OAuth2 tokens', async () => {
    vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: null })

    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        'user@outlook.com': { accessToken: 'at' },
        _metadata: { version: 1 }
      })
    )

    const result = await ensureConfig()

    expect(result).toBe('user@outlook.com:oauth2')
  })

  it('returns null from checkSavedOAuthTokens when token file has no email entries', async () => {
    vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: null })

    // Token file exists but has no email keys
    mockExistsSync.mockImplementation((path) => {
      if (String(path).includes('tokens.json')) return true
      return false
    })
    mockReadFileSync.mockReturnValue(JSON.stringify({ _metadata: { version: 1 } }))

    // createSession should be called because checkSavedOAuthTokens returns null
    vi.mocked(createSession).mockRejectedValue(new Error('Connection refused'))

    const result = await ensureConfig()
    expect(result).toBeNull()
    expect(createSession).toHaveBeenCalled()
  })

  it('returns null from checkSavedOAuthTokens when token file is invalid JSON', async () => {
    vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: null })

    mockExistsSync.mockImplementation((path) => {
      if (String(path).includes('tokens.json')) return true
      return false
    })
    mockReadFileSync.mockImplementation(() => {
      throw new Error('Invalid JSON')
    })

    vi.mocked(createSession).mockRejectedValue(new Error('Connection refused'))

    const result = await ensureConfig()
    expect(result).toBeNull()
    expect(createSession).toHaveBeenCalled()
  })

  it('triggers relay when no config found and returns credentials', async () => {
    vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: null })
    vi.mocked(createSession).mockResolvedValue({
      sessionId: 'test-session',
      keyPair: {} as any,
      passphrase: 'word1-word2-word3-word4',
      relayUrl: 'https://relay.example.com/setup?s=test-session#k=key&p=pass'
    })
    vi.mocked(pollForResult).mockResolvedValue({
      EMAIL_CREDENTIALS: 'user@yahoo.com:app-pass-123'
    })

    const result = await ensureConfig()

    expect(result).toBe('user@yahoo.com:app-pass-123')
    expect(createSession).toHaveBeenCalledWith(
      'https://better-email-mcp.n24q02m.com',
      'better-email-mcp',
      expect.objectContaining({ server: 'better-email-mcp' })
    )
    expect(writeConfig).toHaveBeenCalledWith('better-email-mcp', {
      EMAIL_CREDENTIALS: 'user@yahoo.com:app-pass-123'
    })
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('saved successfully'))
  })

  it('returns null when relay server is unreachable', async () => {
    vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: null })
    vi.mocked(createSession).mockRejectedValue(new Error('Connection refused'))

    const result = await ensureConfig()

    expect(result).toBeNull()
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Cannot reach relay server'))
  })

  it('returns null when relay setup times out', async () => {
    vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: null })
    vi.mocked(createSession).mockResolvedValue({
      sessionId: 'test-session',
      keyPair: {} as any,
      passphrase: 'word1-word2-word3-word4',
      relayUrl: 'https://relay.example.com/setup?s=test'
    })
    vi.mocked(pollForResult).mockRejectedValue(new Error('Relay setup timed out'))

    const result = await ensureConfig()

    expect(result).toBeNull()
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('timed out'))
  })

  it('returns null when user skips relay', async () => {
    vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: null })
    vi.mocked(createSession).mockResolvedValue({
      sessionId: 'test-session',
      keyPair: {} as any,
      passphrase: 'word1-word2-word3-word4',
      relayUrl: 'https://relay.example.com/setup?s=test'
    })
    vi.mocked(pollForResult).mockRejectedValue(new Error('RELAY_SKIPPED'))

    const result = await ensureConfig()

    expect(result).toBeNull()
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('skipped'))
  })

  it('logs relay URL to stderr for user visibility', async () => {
    vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: null })
    const relayUrl = 'https://better-email-mcp.n24q02m.com/setup?s=abc#k=key&p=pass'
    vi.mocked(createSession).mockResolvedValue({
      sessionId: 'abc',
      keyPair: {} as any,
      passphrase: 'test',
      relayUrl
    })
    vi.mocked(pollForResult).mockResolvedValue({
      EMAIL_CREDENTIALS: 'test@test.com:pass'
    })

    await ensureConfig()

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(relayUrl))
  })

  it('sends complete message via relay after successful non-Outlook setup', async () => {
    vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: null })
    vi.mocked(createSession).mockResolvedValue({
      sessionId: 'sid-123',
      keyPair: {} as any,
      passphrase: 'test',
      relayUrl: 'https://relay.example.com/setup?s=sid-123'
    })
    vi.mocked(pollForResult).mockResolvedValue({
      EMAIL_CREDENTIALS: 'test@gmail.com:pass'
    })

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))

    await ensureConfig()

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://better-email-mcp.n24q02m.com/api/sessions/sid-123/messages',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"type":"complete"')
      })
    )

    fetchSpy.mockRestore()
  })

  it('sends device code via relay for Outlook accounts needing OAuth', async () => {
    vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: null })
    vi.mocked(createSession).mockResolvedValue({
      sessionId: 'sid-oauth',
      keyPair: {} as any,
      passphrase: 'test',
      relayUrl: 'https://relay.example.com/setup?s=sid-oauth'
    })
    vi.mocked(pollForResult).mockResolvedValue({
      EMAIL_CREDENTIALS: 'user@outlook.com:oauth2'
    })

    // parseCredentials returns an Outlook account without oauth2
    vi.mocked(parseCredentials).mockResolvedValue([
      {
        id: 'user_outlook_com',
        email: 'user@outlook.com',
        password: 'oauth2',
        authType: 'oauth2',
        imap: { host: 'outlook.office365.com', port: 993, secure: true },
        smtp: { host: 'smtp.office365.com', port: 587, secure: false }
      }
    ])

    // isOutlookDomain returns true for this account
    vi.mocked(isOutlookDomain).mockReturnValue(true)

    // ensureValidToken throws with device code info
    vi.mocked(ensureValidToken).mockRejectedValue(
      new Error(
        'Outlook OAuth2 sign-in required for user@outlook.com.\n' +
          'Visit: https://microsoft.com/devicelogin\n' +
          'Enter code: ABCD-EFGH\n\n' +
          'After signing in, retry your request.'
      )
    )

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))

    const result = await ensureConfig()

    expect(result).toBe('user@outlook.com:oauth2')

    // Should have sent oauth_device_code message via relay
    const deviceCodeCall = fetchSpy.mock.calls.find(
      (call) => typeof call[1]?.body === 'string' && call[1].body.includes('oauth_device_code')
    )
    expect(deviceCodeCall).toBeDefined()
    const body = JSON.parse(deviceCodeCall![1]!.body as string)
    expect(body.type).toBe('oauth_device_code')
    expect(body.data.url).toBe('https://microsoft.com/devicelogin')
    expect(body.data.code).toBe('ABCD-EFGH')
    expect(body.data.email).toBe('user@outlook.com')

    // Should NOT have sent 'complete' message (OAuth pending)
    const completeCall = fetchSpy.mock.calls.find(
      (call) => typeof call[1]?.body === 'string' && call[1].body.includes('"type":"complete"')
    )
    expect(completeCall).toBeUndefined()

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('OAuth device code sent'))

    fetchSpy.mockRestore()
  })

  it('sends info message when parseCredentials throws', async () => {
    vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: null })
    vi.mocked(createSession).mockResolvedValue({
      sessionId: 'sid-err',
      keyPair: {} as any,
      passphrase: 'test',
      relayUrl: 'https://relay.example.com/setup?s=sid-err'
    })
    vi.mocked(pollForResult).mockResolvedValue({
      EMAIL_CREDENTIALS: 'bad@invalid.com:pass'
    })

    // parseCredentials throws
    vi.mocked(parseCredentials).mockRejectedValue(new Error('Parse error'))

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))

    const result = await ensureConfig()

    expect(result).toBe('bad@invalid.com:pass')

    // Should have sent info message via relay
    const infoCall = fetchSpy.mock.calls.find(
      (call) => typeof call[1]?.body === 'string' && call[1].body.includes('"type":"info"')
    )
    expect(infoCall).toBeDefined()

    fetchSpy.mockRestore()
  })

  it('handles fetch failure in catch block gracefully', async () => {
    vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: null })
    vi.mocked(createSession).mockResolvedValue({
      sessionId: 'sid-fetch-fail',
      keyPair: {} as any,
      passphrase: 'test',
      relayUrl: 'https://relay.example.com/setup?s=sid-fetch-fail'
    })
    vi.mocked(pollForResult).mockResolvedValue({
      EMAIL_CREDENTIALS: 'test@gmail.com:pass'
    })

    // parseCredentials throws to trigger the catch block
    vi.mocked(parseCredentials).mockRejectedValue(new Error('Parse error'))

    // fetch itself fails (the .catch(() => {}) should handle it)
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network failure'))

    const result = await ensureConfig()

    // Should still return credentials despite fetch failure
    expect(result).toBe('test@gmail.com:pass')

    fetchSpy.mockRestore()
  })

  it('skips non-Outlook accounts in OAuth check loop', async () => {
    vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: null })
    vi.mocked(createSession).mockResolvedValue({
      sessionId: 'sid-skip',
      keyPair: {} as any,
      passphrase: 'test',
      relayUrl: 'https://relay.example.com/setup?s=sid-skip'
    })
    vi.mocked(pollForResult).mockResolvedValue({
      EMAIL_CREDENTIALS: 'user@gmail.com:pass'
    })

    vi.mocked(parseCredentials).mockResolvedValue([
      {
        id: 'user_gmail_com',
        email: 'user@gmail.com',
        password: 'pass',
        authType: 'password',
        imap: { host: 'imap.gmail.com', port: 993, secure: true },
        smtp: { host: 'smtp.gmail.com', port: 465, secure: true }
      }
    ])

    // isOutlookDomain returns false for gmail
    vi.mocked(isOutlookDomain).mockReturnValue(false)

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))

    const result = await ensureConfig()

    expect(result).toBe('user@gmail.com:pass')
    // ensureValidToken should NOT be called for non-Outlook accounts
    expect(ensureValidToken).not.toHaveBeenCalled()

    // Should send 'complete' message since no OAuth pending
    const completeCall = fetchSpy.mock.calls.find(
      (call) => typeof call[1]?.body === 'string' && call[1].body.includes('"type":"complete"')
    )
    expect(completeCall).toBeDefined()

    fetchSpy.mockRestore()
  })

  it('handles Outlook account with existing oauth2 tokens (no ensureValidToken needed)', async () => {
    vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: null })
    vi.mocked(createSession).mockResolvedValue({
      sessionId: 'sid-has-oauth',
      keyPair: {} as any,
      passphrase: 'test',
      relayUrl: 'https://relay.example.com/setup?s=sid-has-oauth'
    })
    vi.mocked(pollForResult).mockResolvedValue({
      EMAIL_CREDENTIALS: 'user@outlook.com:oauth2'
    })

    // Account already has oauth2 tokens
    vi.mocked(parseCredentials).mockResolvedValue([
      {
        id: 'user_outlook_com',
        email: 'user@outlook.com',
        password: 'oauth2',
        authType: 'oauth2',
        imap: { host: 'outlook.office365.com', port: 993, secure: true },
        smtp: { host: 'smtp.office365.com', port: 587, secure: false },
        oauth2: { accessToken: 'at', refreshToken: 'rt', expiresAt: 999999, clientId: 'cid' }
      }
    ])

    vi.mocked(isOutlookDomain).mockReturnValue(true)

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))

    await ensureConfig()

    // ensureValidToken should NOT be called since account.oauth2 is set
    expect(ensureValidToken).not.toHaveBeenCalled()

    fetchSpy.mockRestore()
  })

  it('handles ensureValidToken error without device code pattern', async () => {
    vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: null })
    vi.mocked(createSession).mockResolvedValue({
      sessionId: 'sid-no-match',
      keyPair: {} as any,
      passphrase: 'test',
      relayUrl: 'https://relay.example.com/setup?s=sid-no-match'
    })
    vi.mocked(pollForResult).mockResolvedValue({
      EMAIL_CREDENTIALS: 'user@outlook.com:oauth2'
    })

    vi.mocked(parseCredentials).mockResolvedValue([
      {
        id: 'user_outlook_com',
        email: 'user@outlook.com',
        password: 'oauth2',
        authType: 'oauth2',
        imap: { host: 'outlook.office365.com', port: 993, secure: true },
        smtp: { host: 'smtp.office365.com', port: 587, secure: false }
      }
    ])

    vi.mocked(isOutlookDomain).mockReturnValue(true)

    // ensureValidToken throws without URL/code pattern
    vi.mocked(ensureValidToken).mockRejectedValue(new Error('Some generic OAuth error'))

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))

    const result = await ensureConfig()

    expect(result).toBe('user@outlook.com:oauth2')

    // No device code message should be sent (pattern did not match)
    const deviceCodeCall = fetchSpy.mock.calls.find(
      (call) => typeof call[1]?.body === 'string' && call[1].body.includes('oauth_device_code')
    )
    expect(deviceCodeCall).toBeUndefined()

    // Complete should be sent since hasOAuthPending is still false
    const completeCall = fetchSpy.mock.calls.find(
      (call) => typeof call[1]?.body === 'string' && call[1].body.includes('"type":"complete"')
    )
    expect(completeCall).toBeDefined()

    fetchSpy.mockRestore()
  })
})
