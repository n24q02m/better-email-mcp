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

import { readFile } from 'node:fs/promises'
import { resolveConfig } from '@n24q02m/mcp-core/storage'

describe('credential-state security', () => {
  let mod: typeof import('./credential-state.js')

  beforeEach(async () => {
    vi.resetModules()
    delete process.env.EMAIL_CREDENTIALS
    mod = await import('./credential-state.js')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('resolveCredentialState should handle null from JSON.parse', async () => {
    vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: '' } as any)
    vi.mocked(readFile).mockResolvedValue('null')

    // Current implementation will try to call Object.keys(null)
    // which throws TypeError
    const result = await mod.resolveCredentialState()
    expect(result).toBe('awaiting_setup')
  })

  it('resolveCredentialState should handle non-object from JSON.parse', async () => {
    vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: '' } as any)
    vi.mocked(readFile).mockResolvedValue('123')

    const result = await mod.resolveCredentialState()
    expect(result).toBe('awaiting_setup')
  })
})
