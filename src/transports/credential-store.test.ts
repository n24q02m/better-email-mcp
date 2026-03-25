import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { _paths, deleteCredentials, loadCredentials, storeCredentials } from './credential-store.js'

describe('credential-store', () => {
  let originalDataDir: string
  let originalCredsPath: string
  let originalSecretPath: string
  let testDir: string

  beforeEach(() => {
    // Save originals
    originalDataDir = _paths.DATA_DIR
    originalCredsPath = _paths.CREDS_PATH
    originalSecretPath = _paths.SECRET_PATH

    // Use temp directory for tests
    testDir = join(tmpdir(), `cred-store-test-${randomBytes(4).toString('hex')}`)
    mkdirSync(testDir, { recursive: true })
    _paths.DATA_DIR = testDir
    _paths.CREDS_PATH = join(testDir, 'credentials.enc')
    _paths.SECRET_PATH = join(testDir, '.secret')

    // Use fixed secret for deterministic tests
    process.env.CREDENTIAL_SECRET = 'test-secret-key-for-testing-only'
  })

  afterEach(() => {
    // Restore originals
    _paths.DATA_DIR = originalDataDir
    _paths.CREDS_PATH = originalCredsPath
    _paths.SECRET_PATH = originalSecretPath
    delete process.env.CREDENTIAL_SECRET

    // Cleanup
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  it('should return null when no credentials file exists', async () => {
    const result = await loadCredentials()
    expect(result).toBeNull()
  })

  it('should store and load credentials roundtrip', async () => {
    const creds = { email: 'test@gmail.com', password: 'app-password-1234' }

    await storeCredentials(creds)
    expect(existsSync(_paths.CREDS_PATH)).toBe(true)

    const loaded = await loadCredentials()
    expect(loaded).toEqual(creds)
  })

  it('should store and load credentials with extra fields', async () => {
    const creds = {
      email: 'user@custom.com',
      password: 'my:pass:word',
      imap_host: 'imap.custom.com'
    }

    await storeCredentials(creds)
    const loaded = await loadCredentials()
    expect(loaded).toEqual(creds)
  })

  it('should delete credentials file', async () => {
    const creds = { email: 'test@gmail.com', password: 'pass' }
    await storeCredentials(creds)
    expect(existsSync(_paths.CREDS_PATH)).toBe(true)

    await deleteCredentials()
    expect(existsSync(_paths.CREDS_PATH)).toBe(false)
  })

  it('should not throw when deleting non-existent credentials', async () => {
    await expect(deleteCredentials()).resolves.toBeUndefined()
  })

  it('should overwrite existing credentials', async () => {
    const creds1 = { email: 'first@gmail.com', password: 'pass1' }
    const creds2 = { email: 'second@gmail.com', password: 'pass2' }

    await storeCredentials(creds1)
    await storeCredentials(creds2)

    const loaded = await loadCredentials()
    expect(loaded).toEqual(creds2)
  })

  it('should fail to decrypt with wrong secret', async () => {
    const creds = { email: 'test@gmail.com', password: 'pass' }
    await storeCredentials(creds)

    // Change secret
    process.env.CREDENTIAL_SECRET = 'different-secret-key'

    await expect(loadCredentials()).rejects.toThrow()
  })
})
