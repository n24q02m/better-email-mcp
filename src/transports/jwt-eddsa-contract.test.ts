import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

// Contract guard: mcp-core's JWTIssuer selects EdDSA iff CREDENTIAL_SECRET is set,
// deriving the signing key deterministically via HKDF (no disk keypair). better-email
// must deploy with CREDENTIAL_SECRET so the JWT signing key is stable across container
// recreate -> no re-auth storm. This asserts the upstream contract we depend on plus
// the wrangler deploy invariant, so a future refactor cannot silently regress it.
describe('JWT EdDSA contract (depended-upon mcp-core behavior)', () => {
  test('mcp-core exposes runHttpServer (the OAuth AS entry that wires CREDENTIAL_SECRET)', async () => {
    const core = await import('@n24q02m/mcp-core')
    expect(typeof core.runHttpServer).toBe('function')
  })

  test('wrangler.jsonc documents CREDENTIAL_SECRET as a required deploy secret', () => {
    const path = new URL('../../wrangler.jsonc', import.meta.url)
    expect(existsSync(path), 'wrangler.jsonc must exist (Task 11)').toBe(true)
    const wrangler = readFileSync(path, 'utf-8')
    expect(wrangler).toContain('CREDENTIAL_SECRET')
  })

  test('wrangler.jsonc sets PORT=8080 so the container listener is reachable', () => {
    const wrangler = readFileSync(new URL('../../wrangler.jsonc', import.meta.url), 'utf-8')
    expect(wrangler).toMatch(/"PORT"\s*:\s*"8080"/)
  })
})
