import { readFile } from 'node:fs/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureConfig, formatCredentials } from './relay-setup.js'

// Mock node:fs/promises for checkSavedOAuthTokens
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockRejectedValue(new Error('File not found'))
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
  isOutlookDomain: vi.fn().mockReturnValue(false),
  _getPendingAuths: vi.fn().mockReturnValue(new Map())
}))

// Import after mocks
import { createSession, pollForResult } from '@n24q02m/mcp-relay-core/relay'
import { resolveConfig } from '@n24q02m/mcp-relay-core/storage'
import { parseCredentials } from './tools/helpers/config.js'
import { ensureValidToken, isOutlookDomain } from './tools/helpers/oauth2.js'

const mockReadFile = vi.mocked(readFile)

describe('formatCredentials', () => {
  it('formats email:password when no imap_host', () => {
    const result = formatCredentials({ email: 'user@gmail.com', password: 'secret123' })
    expect(result).toBe('user@gmail.com:secret123')
  })

  it('formats email:password:imap_host when imap_host is present', () => {
    const result = formatCredentials({ email: 'user@gmail.com', password: 'pass', imap_host: 'imap.custom.com' })
    expect(result).toBe('user@gmail.com:pass:imap.custom.com')
  })

  it('prioritizes EMAIL_CREDENTIALS field if present', () => {
    const result = formatCredentials({
      EMAIL_CREDENTIALS: 'custom:creds',
      email: 'ignore',
      password: 'me'
    })
    expect(result).toBe('custom:creds')
  })

  it('throws error when required fields missing', () => {
    expect(() => formatCredentials({})).toThrow('Relay config missing required fields')
  })
})

describe('ensureConfig', () => {
  let consoleSpy: any

  beforeEach(() => {
    vi.clearAllMocks()
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it('returns credentials from encrypted config file if present', async () => {
    vi.mocked(resolveConfig).mockResolvedValue({
      config: { EMAIL_CREDENTIALS: 'file:creds' },
      source: '~/.config/mcp/config.enc'
    })

    const result = await ensureConfig()

    expect(result).toBe('file:creds')
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Email config loaded from'))
  })

  it('returns credentials from saved OAuth tokens if config file missing', async () => {
    vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: null })

    // Mock checkSavedOAuthTokens: readFile returns token store
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        'user1@outlook.com': { accessToken: 'at1' },
        'user2@outlook.com': { accessToken: 'at2' }
      })
    )

    const result = await ensureConfig()

    expect(result).toBe('user1@outlook.com:oauth2,user2@outlook.com:oauth2')
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Found saved OAuth2 tokens'))
  })

  it('triggers relay setup when no local credentials found', async () => {
    vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: null })
    mockReadFile.mockRejectedValue(new Error('ENOENT'))

    const relayUrl = 'https://better-email-mcp.n24q02m.com'
    vi.mocked(createSession).mockResolvedValue({
      sessionId: 'sid-123',
      keyPair: {} as any,
      passphrase: 'test',
      relayUrl: `${relayUrl}/setup?s=sid-123`
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
    ] as any)

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

    // Should sent 'complete' message (Wait for completion)
    const completeCall = fetchSpy.mock.calls.find(
      (call) => typeof call[1]?.body === 'string' && call[1].body.includes('"type":"complete"')
    )
    expect(completeCall).toBeDefined()
    const bodyComplete = JSON.parse(completeCall![1]!.body as string)
    expect(bodyComplete.text).toContain('Setup complete')

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
    ] as any)

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
    ] as any)

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
    ] as any)

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
