import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  _deriveKey,
  _getSecret,
  _paths,
  _resetSecretCache,
  hashUserId,
  loadAllUserCredentials,
  loadUserCredentials
} from './per-user-credential-store.js'

describe('per-user-credential-store security', () => {
  const testDir = join(tmpdir(), `per-user-security-${randomBytes(4).toString('hex')}`)

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
    mkdirSync(testDir, { recursive: true })
    _paths.DATA_DIR = join(testDir, 'users')
    _paths.SECRET_PATH = join(testDir, '.user-secret')
    _resetSecretCache()
  })

  async function createEncryptedFile(userId: string, payload: string) {
    const dirHash = hashUserId(userId)
    const userDir = join(_paths.DATA_DIR, dirHash)
    mkdirSync(userDir, { recursive: true })

    const secret = await _getSecret()
    const key = await _deriveKey(secret, dirHash)
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const plaintext = new TextEncoder().encode(payload)
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
    const combined = Buffer.concat([iv, Buffer.from(encrypted)])
    writeFileSync(join(userDir, 'credentials.enc'), combined)
  }

  it('loadUserCredentials should handle null from JSON.parse', async () => {
    await createEncryptedFile('null-user', 'null')

    // Should NOT throw TypeError: Cannot read properties of null
    // It currently DOES throw TypeError, which is caught and rethrown in loadUserCredentials
    try {
      await loadUserCredentials('null-user')
    } catch (err: any) {
      expect(err.name).not.toBe('TypeError')
    }
  })

  it('loadAllUserCredentials should handle malformed JSON entries', async () => {
    await createEncryptedFile('bad-json', '[]') // Array instead of object

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Should not crash, should just skip.
    // Currently it catches TypeError and logs it.
    const all = await loadAllUserCredentials()
    expect(all.has('bad-json')).toBe(false)

    // If it was a TypeError, it means it crashed during property access
    if (spy.mock.calls.length > 0) {
      expect(spy.mock.calls[0][1].name).not.toBe('TypeError')
    }

    spy.mockRestore()
  })
})
