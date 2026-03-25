import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureConfig, formatCredentials } from './relay-setup.js'

// Mock mcp-relay-core modules
vi.mock('@n24q02m/mcp-relay-core/storage', () => ({
  resolveConfig: vi.fn()
}))
vi.mock('@n24q02m/mcp-relay-core/relay', () => ({
  createSession: vi.fn(),
  pollForResult: vi.fn()
}))
vi.mock('@n24q02m/mcp-relay-core', () => ({
  writeConfig: vi.fn()
}))

import { writeConfig } from '@n24q02m/mcp-relay-core'
import { createSession, pollForResult } from '@n24q02m/mcp-relay-core/relay'
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
      config: { email: 'user@gmail.com', password: 'app-pass' },
      source: 'file'
    })

    const result = await ensureConfig()

    expect(result).toBe('user@gmail.com:app-pass')
    expect(resolveConfig).toHaveBeenCalledWith('better-email-mcp', ['email', 'password'])
    expect(createSession).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('loaded from file'))
  })

  it('returns formatted credentials with imap_host from config file', async () => {
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
      email: 'user@yahoo.com',
      password: 'app-pass-123'
    })

    const result = await ensureConfig()

    expect(result).toBe('user@yahoo.com:app-pass-123')
    expect(createSession).toHaveBeenCalledWith(
      'https://better-email-mcp.n24q02m.com',
      'better-email-mcp',
      expect.objectContaining({ server: 'better-email-mcp' })
    )
    expect(writeConfig).toHaveBeenCalledWith('better-email-mcp', {
      email: 'user@yahoo.com',
      password: 'app-pass-123'
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
      email: 'test@test.com',
      password: 'pass'
    })

    await ensureConfig()

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(relayUrl))
  })
})
