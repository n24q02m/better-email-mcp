import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock all external dependencies BEFORE importing the module under test
vi.mock('@n24q02m/mcp-core/storage', () => ({
  resolveConfig: vi.fn()
}))

vi.mock('@n24q02m/mcp-core', () => ({
  writeConfig: vi.fn().mockResolvedValue(undefined),
  deleteConfig: vi.fn().mockResolvedValue(undefined),
  tryOpenBrowser: vi.fn()
}))

vi.mock('./relay-setup.js', () => ({
  formatCredentials: vi.fn().mockReturnValue('test@example.com:testpass')
}))

vi.mock('./tools/helpers/config.js', () => ({
  parseCredentials: vi.fn().mockResolvedValue([])
}))

vi.mock('./tools/helpers/oauth2.js', () => ({
  ensureValidToken: vi.fn(),
  isOutlookDomain: vi.fn().mockReturnValue(false),
  isValidTokenStore: vi.fn().mockReturnValue(true),
  loadOutlookEmails: vi.fn().mockResolvedValue([]),
  _getPendingAuths: vi.fn().mockReturnValue(new Set())
}))

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  readdir: vi.fn(),
  rm: vi.fn()
}))

vi.mock('node:os', () => ({
  homedir: vi.fn().mockReturnValue('/tmp/test-home')
}))

vi.mock('node:path', () => ({
  join: vi.fn((...args: string[]) => args.join('/'))
}))

import { resolveConfig } from '@n24q02m/mcp-core/storage'
import { loadOutlookEmails } from './tools/helpers/oauth2.js'

describe('credential-state', () => {
  let mod: typeof import('./credential-state.js')

  beforeEach(async () => {
    vi.resetModules()
    // Reset env
    delete process.env.EMAIL_CREDENTIALS
    delete process.env.EMAIL_USER
    delete process.env.EMAIL_APP_PASSWORD
    delete process.env.EMAIL_PROVIDER
    delete process.env.MCP_RELAY_URL
    // Re-import to get fresh module state
    mod = await import('./credential-state.js')
  })

  afterEach(() => {
    delete process.env.EMAIL_CREDENTIALS
    delete process.env.EMAIL_USER
    delete process.env.EMAIL_APP_PASSWORD
    delete process.env.EMAIL_PROVIDER
    vi.restoreAllMocks()
  })

  describe('getState / getSetupUrl', () => {
    it('returns awaiting_setup by default', () => {
      expect(mod.getState()).toBe('awaiting_setup')
    })

    it('returns null setup URL by default', () => {
      expect(mod.getSetupUrl()).toBeNull()
    })
  })

  describe('setState', () => {
    it('sets state to configured', () => {
      mod.setState('configured')
      expect(mod.getState()).toBe('configured')
    })

    it('sets state to setup_in_progress', () => {
      mod.setState('setup_in_progress')
      expect(mod.getState()).toBe('setup_in_progress')
    })
  })

  describe('setSetupUrl', () => {
    it('sets the setup URL', () => {
      const url = 'http://localhost:3000/setup'
      mod.setSetupUrl(url)
      expect(mod.getSetupUrl()).toBe(url)
    })

    it('allows clearing the setup URL with null', () => {
      mod.setSetupUrl('http://localhost:3000/setup')
      mod.setSetupUrl(null)
      expect(mod.getSetupUrl()).toBeNull()
    })

    it('handles undefined (type casting)', () => {
      mod.setSetupUrl(undefined as unknown as string)
      expect(mod.getSetupUrl()).toBeUndefined()
    })

    it('handles empty string', () => {
      mod.setSetupUrl('')
      expect(mod.getSetupUrl()).toBe('')
    })

    it('handles malformed URL', () => {
      mod.setSetupUrl('not-a-url')
      expect(mod.getSetupUrl()).toBe('not-a-url')
    })

    it('updates correctly when called multiple times', () => {
      mod.setSetupUrl('http://first.com')
      expect(mod.getSetupUrl()).toBe('http://first.com')
      mod.setSetupUrl(null)
      expect(mod.getSetupUrl()).toBeNull()
      mod.setSetupUrl('http://second.com')
      expect(mod.getSetupUrl()).toBe('http://second.com')
    })

    it('handles very long strings', () => {
      const longUrl = 'a'.repeat(10000)
      mod.setSetupUrl(longUrl)
      expect(mod.getSetupUrl()).toBe(longUrl)
    })

    it('handles special characters and emoji', () => {
      const specialUrl = 'https://example.com/🚀?q=✨'
      mod.setSetupUrl(specialUrl)
      expect(mod.getSetupUrl()).toBe(specialUrl)
    })
  })

  describe('resolveCredentialState', () => {
    it('returns configured when EMAIL_CREDENTIALS env is set', async () => {
      process.env.EMAIL_CREDENTIALS = 'test@example.com:testpass'
      const result = await mod.resolveCredentialState()
      expect(result).toBe('configured')
      expect(mod.getState()).toBe('configured')
    })

    it('returns configured when EMAIL_USER + EMAIL_APP_PASSWORD env vars are set (stdio per-field)', async () => {
      process.env.EMAIL_USER = 'test@example.com'
      process.env.EMAIL_APP_PASSWORD = 'test-password'
      const result = await mod.resolveCredentialState()
      expect(result).toBe('configured')
      expect(process.env.EMAIL_CREDENTIALS).toBe('test@example.com:test-password')
    })

    it('returns awaiting_setup when only EMAIL_USER is set', async () => {
      process.env.EMAIL_USER = 'test@example.com'
      const result = await mod.resolveCredentialState()
      expect(result).toBe('awaiting_setup')
    })

    it('returns awaiting_setup when only EMAIL_APP_PASSWORD is set', async () => {
      process.env.EMAIL_APP_PASSWORD = 'test-password'
      const result = await mod.resolveCredentialState()
      expect(result).toBe('awaiting_setup')
    })

    it('returns configured when config file has credentials', async () => {
      vi.mocked(resolveConfig).mockResolvedValue({
        config: { EMAIL_CREDENTIALS: 'test@example.com:testpass' },
        source: 'file'
      } as any)
      const { formatCredentials } = await import('./relay-setup.js')
      vi.mocked(formatCredentials).mockReturnValue('test@example.com:testpass')

      const result = await mod.resolveCredentialState()
      expect(result).toBe('configured')
      expect(process.env.EMAIL_CREDENTIALS).toBe('test@example.com:testpass')
    })

    it('returns configured when saved OAuth tokens exist (via the token facade)', async () => {
      vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: '' } as any)
      vi.mocked(loadOutlookEmails).mockResolvedValue(['test@outlook.com'])

      const result = await mod.resolveCredentialState()
      expect(result).toBe('configured')
      expect(process.env.EMAIL_CREDENTIALS).toBe('test@outlook.com:oauth2')
    })

    it('joins multiple saved OAuth token emails into the credential string', async () => {
      vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: '' } as any)
      vi.mocked(loadOutlookEmails).mockResolvedValue(['a@outlook.com', 'b@hotmail.com'])

      const result = await mod.resolveCredentialState()
      expect(result).toBe('configured')
      expect(process.env.EMAIL_CREDENTIALS).toBe('a@outlook.com:oauth2,b@hotmail.com:oauth2')
    })

    it('returns awaiting_setup when nothing found (facade returns no emails)', async () => {
      vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: '' } as any)
      vi.mocked(loadOutlookEmails).mockResolvedValue([])

      const result = await mod.resolveCredentialState()
      expect(result).toBe('awaiting_setup')
    })

    it('handles config read error gracefully', async () => {
      vi.mocked(resolveConfig).mockRejectedValue(new Error('decrypt fail'))
      vi.mocked(loadOutlookEmails).mockResolvedValue([])

      const result = await mod.resolveCredentialState()
      expect(result).toBe('awaiting_setup')
    })

    it('handles a token facade error gracefully', async () => {
      vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: '' } as any)
      vi.mocked(loadOutlookEmails).mockRejectedValue(new Error('READ_ERROR'))

      const result = await mod.resolveCredentialState()
      expect(result).toBe('awaiting_setup')
    })
  })

  describe('setMarkSetupComplete / getMarkSetupComplete', () => {
    it('stores and returns the hook fn', () => {
      const hook = vi.fn()
      mod.setMarkSetupComplete(hook)
      expect(mod.getMarkSetupComplete()).toBe(hook)
    })

    it('allows clearing the hook with null', () => {
      mod.setMarkSetupComplete(vi.fn())
      mod.setMarkSetupComplete(null)
      expect(mod.getMarkSetupComplete()).toBeNull()
    })

    it('returns null by default (fresh module)', () => {
      expect(mod.getMarkSetupComplete()).toBeNull()
    })
  })

  describe('resetState', () => {
    it('resets to awaiting_setup and clears setupUrl', async () => {
      mod.setState('configured')
      mod.setSetupUrl('http://localhost:3000/setup')

      await mod.resetState()

      expect(mod.getState()).toBe('awaiting_setup')
      expect(mod.getSetupUrl()).toBeNull()
    })

    it('handles deleteConfig error gracefully', async () => {
      const { deleteConfig } = await import('@n24q02m/mcp-core')
      vi.mocked(deleteConfig).mockRejectedValue(new Error('file not found'))

      mod.setState('configured')
      await mod.resetState()
      expect(mod.getState()).toBe('awaiting_setup')
    })
  })
})
