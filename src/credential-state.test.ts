import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock all external dependencies BEFORE importing the module under test
vi.mock('@n24q02m/mcp-core/storage', () => ({
  resolveConfig: vi.fn()
}))

vi.mock('@n24q02m/mcp-core', () => ({
  runLocalServer: vi.fn(),
  writeConfig: vi.fn().mockResolvedValue(undefined),
  deleteConfig: vi.fn().mockResolvedValue(undefined),
  tryOpenBrowser: vi.fn()
}))

vi.mock('./relay-schema.js', () => ({
  RELAY_SCHEMA: { fields: [] }
}))

vi.mock('./relay-setup.js', () => ({
  formatCredentials: vi.fn().mockReturnValue('user@gmail.com:pass')
}))

vi.mock('./tools/helpers/config.js', () => ({
  parseCredentials: vi.fn().mockResolvedValue([])
}))

vi.mock('./tools/helpers/oauth2.js', () => ({
  ensureValidToken: vi.fn(),
  isOutlookDomain: vi.fn().mockReturnValue(false),
  _getPendingAuths: vi.fn().mockReturnValue(new Set())
}))

vi.mock('node:fs/promises', () => ({
  // Full set needed because per-user-credential-store (imported transitively
  // via spawn-setup) captures these into its _fs re-export at module-eval
  // time. Vitest's strict mock throws if any are read and undefined.
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

import { readFile } from 'node:fs/promises'
import { resolveConfig } from '@n24q02m/mcp-core/storage'

describe('credential-state', () => {
  let mod: typeof import('./credential-state.js')

  beforeEach(async () => {
    vi.resetModules()
    // Reset env
    delete process.env.EMAIL_CREDENTIALS
    delete process.env.MCP_RELAY_URL
    // Re-import to get fresh module state
    mod = await import('./credential-state.js')
  })

  afterEach(() => {
    delete process.env.EMAIL_CREDENTIALS
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

  describe('resolveCredentialState', () => {
    it('returns configured when EMAIL_CREDENTIALS env is set', async () => {
      process.env.EMAIL_CREDENTIALS = 'user@gmail.com:pass'
      const result = await mod.resolveCredentialState()
      expect(result).toBe('configured')
      expect(mod.getState()).toBe('configured')
    })

    it('returns configured when config file has credentials', async () => {
      vi.mocked(resolveConfig).mockResolvedValue({
        config: { EMAIL_CREDENTIALS: 'user@test.com:pass' },
        source: 'file'
      } as any)
      const { formatCredentials } = await import('./relay-setup.js')
      vi.mocked(formatCredentials).mockReturnValue('user@test.com:pass')

      const result = await mod.resolveCredentialState()
      expect(result).toBe('configured')
      expect(process.env.EMAIL_CREDENTIALS).toBe('user@test.com:pass')
    })

    it('returns configured when saved OAuth tokens exist', async () => {
      vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: '' } as any)
      vi.mocked(readFile).mockResolvedValue(JSON.stringify({ 'user@outlook.com': { accessToken: 'tok' } }) as any)

      const result = await mod.resolveCredentialState()
      expect(result).toBe('configured')
      expect(process.env.EMAIL_CREDENTIALS).toBe('user@outlook.com:oauth2')
    })

    it('returns awaiting_setup when nothing found', async () => {
      vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: '' } as any)
      vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'))

      const result = await mod.resolveCredentialState()
      expect(result).toBe('awaiting_setup')
    })

    it('handles config read error gracefully', async () => {
      vi.mocked(resolveConfig).mockRejectedValue(new Error('decrypt fail'))
      vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'))

      const result = await mod.resolveCredentialState()
      expect(result).toBe('awaiting_setup')
    })

    it('handles token read error gracefully', async () => {
      vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: '' } as any)
      vi.mocked(readFile).mockImplementation(() => {
        throw new Error('READ_ERROR')
      })

      const result = await mod.resolveCredentialState()
      expect(result).toBe('awaiting_setup')
    })

    it('skips token entries without @ sign', async () => {
      vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: '' } as any)
      vi.mocked(readFile).mockResolvedValue(JSON.stringify({ metadata: { version: 1 } }) as any)

      const result = await mod.resolveCredentialState()
      expect(result).toBe('awaiting_setup')
    })
  })

  describe('triggerRelaySetup', () => {
    function makeHandle(port = 54321) {
      return { host: '127.0.0.1', port, close: vi.fn().mockResolvedValue(undefined) }
    }

    it('returns existing setup URL when not awaiting_setup', async () => {
      mod.setState('configured')
      const result = await mod.triggerRelaySetup()
      expect(result).toBeNull() // no setupUrl set
    })

    it('spawns a local HTTP server and returns its URL', async () => {
      const { runLocalServer } = await import('@n24q02m/mcp-core')
      vi.mocked(runLocalServer).mockResolvedValue(makeHandle(56789) as any)

      const result = await mod.triggerRelaySetup()
      expect(result).toBe('http://127.0.0.1:56789/')
      expect(mod.getState()).toBe('setup_in_progress')

      const call = vi.mocked(runLocalServer).mock.calls[0]
      expect(call[1].port).toBe(0)
      expect(call[1].host).toBe('127.0.0.1')
      expect(call[1].serverName).toBe('better-email-mcp')
    })

    it('returns null when local spawn fails', async () => {
      const { runLocalServer } = await import('@n24q02m/mcp-core')
      vi.mocked(runLocalServer).mockRejectedValue(new Error('cannot bind'))

      const result = await mod.triggerRelaySetup()
      expect(result).toBeNull()
      expect(mod.getState()).toBe('awaiting_setup')
    })

    it('force triggers even when configured', async () => {
      mod.setState('configured')
      const { runLocalServer } = await import('@n24q02m/mcp-core')
      vi.mocked(runLocalServer).mockResolvedValue(makeHandle(60001) as any)

      const result = await mod.triggerRelaySetup({ force: true })
      expect(result).toBe('http://127.0.0.1:60001/')
      expect(mod.getState()).toBe('setup_in_progress')
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
    it('resets to awaiting_setup', async () => {
      mod.setState('configured')
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
