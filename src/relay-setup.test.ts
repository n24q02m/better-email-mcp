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
  pollForResult: vi.fn(),
  sendMessage: vi.fn().mockResolvedValue(undefined)
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
import { createSession, pollForResult, sendMessage } from '@n24q02m/mcp-relay-core/relay'
// Import after mocks
import { resolveConfig } from '@n24q02m/mcp-relay-core/storage'

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

    await ensureConfig()

    expect(sendMessage).toHaveBeenCalledWith('https://better-email-mcp.n24q02m.com', 'sid-123', {
      type: 'complete',
      text: 'Setup complete! All accounts configured.'
    })
  })
})
