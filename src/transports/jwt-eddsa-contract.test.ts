import { readFileSync } from 'node:fs'
import { runHttpServer } from '@n24q02m/mcp-core'
import { describe, expect, test } from 'vitest'

// Contract guard: mcp-core's JWTIssuer selects EdDSA iff CREDENTIAL_SECRET is set,
// deriving the signing key deterministically via HKDF (no disk keypair). better-email
// must deploy with CREDENTIAL_SECRET so the JWT signing key is stable across container
// recreate -> no re-auth storm. This asserts the upstream contract we depend on plus
// the self-host compose invariant, so a future refactor cannot silently regress it.
describe('JWT EdDSA contract (depended-upon mcp-core behavior)', () => {
  test('mcp-core exposes runHttpServer (the OAuth AS entry that wires CREDENTIAL_SECRET)', () => {
    expect(typeof runHttpServer).toBe('function')
  })

  test('docker-compose.http.yml refuses to start without CREDENTIAL_SECRET', () => {
    const compose = readFileSync(new URL('../../docker-compose.http.yml', import.meta.url), 'utf-8')
    expect(compose).toMatch(/CREDENTIAL_SECRET=\$\{CREDENTIAL_SECRET:\?/)
  })

  test('docker-compose.http.yml publishes the 8080 container listener on host loopback only', () => {
    const compose = readFileSync(new URL('../../docker-compose.http.yml', import.meta.url), 'utf-8')
    expect(compose).toMatch(/"127\.0\.0\.1:\d+:8080"/)
    expect(compose).not.toMatch(/^\s*-\s*"\d+:8080"/m)
  })
})
