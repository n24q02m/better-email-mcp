import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

describe('mcp-core dependency pin', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'))

  test('depends on a 1.18.0-beta+ release that ships the storage backends + EdDSA', () => {
    const dep: string = pkg.dependencies['@n24q02m/mcp-core']
    // Storage backends (CfKvBackend/backendFromEnv) + EdDSA-from-CREDENTIAL_SECRET
    // ship in the 1.18.0-beta line; the old exact 1.17.4 pin lacks them.
    expect(dep).toContain('1.18.0-beta')
    expect(dep).not.toBe('1.17.4')
  })

  test('does not use a path/workspace source for mcp-core (npm dependency only)', () => {
    const dep: string = pkg.dependencies['@n24q02m/mcp-core']
    expect(dep).not.toMatch(/^(file:|link:|workspace:|\.\.?\/)/)
  })

  test('CfKvBackend + PerPluginStore + backendFromEnv are importable from the storage entry', async () => {
    const storage = await import('@n24q02m/mcp-core/storage')
    expect(typeof storage.CfKvBackend).toBe('function')
    expect(typeof storage.InMemoryBackend).toBe('function')
    expect(typeof storage.backendFromEnv).toBe('function')
    expect(typeof storage.PerPluginStore).toBe('function')
  })
})
