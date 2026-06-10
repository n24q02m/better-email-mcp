import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import * as fsPromises from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountConfig } from '../tools/helpers/config.js'
import {
  _deriveKey,
  _fs,
  _getSecret,
  _paths,
  _resetSecretCache,
  deleteUserCredentials,
  hashUserId,
  loadAllUserCredentials,
  loadUserCredentials,
  storeUserCredentials
} from './per-user-credential-store.js'

function makeAccount(email: string): AccountConfig {
  return {
    id: Math.random().toString(36).substring(7),
    email,
    password: 'password123',
    imap: { host: 'imap.test.com', port: 993, secure: true },
    smtp: { host: 'smtp.test.com', port: 465, secure: true }
  }
}

describe('per-user-credential-store', () => {
  beforeEach(async () => {
    // Setup temporary directory for each test
    const testDir = join(tmpdir(), `per-user-test-${randomBytes(4).toString('hex')}`)
    _paths.DATA_DIR = join(testDir, 'users')
    _paths.SECRET_PATH = join(testDir, '.user-secret')
    mkdirSync(_paths.DATA_DIR, { recursive: true })

    process.env.CREDENTIAL_SECRET = 'test-global-secret'
    _resetSecretCache()
  })

  describe('store and load', () => {
    it('should store and load credentials for a user', async () => {
      const userId = 'user-1'
      const accounts = [makeAccount('user1@example.com'), makeAccount('user1-alt@example.com')]

      await storeUserCredentials(userId, accounts)
      const loaded = await loadUserCredentials(userId)

      expect(loaded).toHaveLength(2)
      expect(loaded![0]!.email).toBe('user1@example.com')
      expect(loaded![1]!.email).toBe('user1-alt@example.com')
    })

    it('should return null for non-existent user', async () => {
      const loaded = await loadUserCredentials('non-existent')
      expect(loaded).toBeNull()
    })
  })

  describe('deriveKey', () => {
    it('should use default userId when not provided', async () => {
      const key1 = await _deriveKey('secret')
      const key2 = await _deriveKey('secret', '')
      const key3 = await _deriveKey('secret', 'other')

      // Web Crypto keys are opaque, but we can verify they are generated
      expect(key1).toBeDefined()
      expect(key2).toBeDefined()
      expect(key3).toBeDefined()
    })

    it('should use explicit iterations when provided', async () => {
      const secret = 'test-secret'
      const keyWithExplicit = await _deriveKey(secret, 'user', 1000)
      expect(keyWithExplicit).toBeDefined()
    })
  })

  describe('hashUserId', () => {
    it('should return a 16-char hex string', () => {
      const hash = hashUserId('user-123')
      expect(hash).toHaveLength(16)
      expect(hash).toMatch(/^[0-9a-f]+$/)
    })

    it('should produce deterministic results', () => {
      const hash1 = hashUserId('user-1')
      const hash2 = hashUserId('user-1')
      expect(hash1).toBe(hash2)
    })
  })

  describe('loadAllUserCredentials', () => {
    it('should load all stored user credentials', async () => {
      const user1 = 'user-1'
      const user2 = 'user-2'
      const accounts1 = [makeAccount('u1@test.com')]
      const accounts2 = [makeAccount('u2@test.com')]

      await storeUserCredentials(user1, accounts1)
      await storeUserCredentials(user2, accounts2)

      const all = await loadAllUserCredentials()
      expect(all.size).toBe(2)
      expect(all.get(user1)![0]!.email).toBe('u1@test.com')
      expect(all.get(user2)![0]!.email).toBe('u2@test.com')
    })

    it('should return empty map if DATA_DIR does not exist', async () => {
      _paths.DATA_DIR = join(tmpdir(), `non-existent-${randomBytes(4).toString('hex')}`)
      const all = await loadAllUserCredentials()
      expect(all.size).toBe(0)
    })
  })

  describe('deleteUserCredentials', () => {
    it('should delete user credentials', async () => {
      await storeUserCredentials('keep', [makeAccount('keep@gmail.com')])
      await storeUserCredentials('delete', [makeAccount('del@gmail.com')])

      await deleteUserCredentials('delete')

      expect(await loadUserCredentials('keep')).not.toBeNull()
      expect(await loadUserCredentials('delete')).toBeNull()
    })
  })

  describe('encryption', () => {
    it('should fail to decrypt with wrong secret', async () => {
      await storeUserCredentials('enc-user', [makeAccount('enc@gmail.com')])

      process.env.CREDENTIAL_SECRET = 'wrong-secret'
      _resetSecretCache()

      await expect(loadUserCredentials('enc-user')).rejects.toThrow()
    })
  })

  describe('getSecret auto-generation', () => {
    it('should auto-generate secret when no env var set', async () => {
      delete process.env.CREDENTIAL_SECRET
      _resetSecretCache()

      const accounts = [makeAccount('auto@gmail.com')]
      await storeUserCredentials('auto-user', accounts)

      // Secret file should be created
      expect(existsSync(_paths.SECRET_PATH)).toBe(true)

      // Should be able to load back
      const loaded = await loadUserCredentials('auto-user')
      expect(loaded).toEqual(accounts)
    })

    it('should reuse existing secret file', async () => {
      delete process.env.CREDENTIAL_SECRET
      _resetSecretCache()

      // First store creates the secret
      await storeUserCredentials('first-user', [makeAccount('first@gmail.com')])

      // Reset cache so next call reads from file
      _resetSecretCache()

      // Second store should now read the secret from the file
      await storeUserCredentials('second-user', [makeAccount('second@gmail.com')])

      // Both should be loadable
      const first = await loadUserCredentials('first-user')
      const second = await loadUserCredentials('second-user')
      expect(first![0]!.email).toBe('first@gmail.com')
      expect(second![0]!.email).toBe('second@gmail.com')
    })

    it('should create parent directory if it does not exist', async () => {
      delete process.env.CREDENTIAL_SECRET
      _resetSecretCache()

      // Re-initialize paths to a non-existent parent
      const deepDir = join(tmpdir(), `per-user-deep-${randomBytes(4).toString('hex')}`)
      const parentDir = join(deepDir, 'parent')
      _paths.DATA_DIR = join(parentDir, 'users')
      _paths.SECRET_PATH = join(parentDir, '.user-secret')

      // Ensure it doesn't exist
      if (existsSync(deepDir)) {
        rmSync(deepDir, { recursive: true, force: true })
      }

      try {
        // Trigger getSecret directly to test directory creation logic
        await _getSecret()
        expect(existsSync(parentDir)).toBe(true)
        expect(existsSync(_paths.SECRET_PATH)).toBe(true)
      } finally {
        if (existsSync(deepDir)) {
          rmSync(deepDir, { recursive: true, force: true })
        }
      }
    })

    it('should throw non-ENOENT errors from readdir in loadAll', async () => {
      const readdirSpy = vi.spyOn(_fs, 'readdir').mockRejectedValue(new Error('EACCES'))
      await expect(loadAllUserCredentials()).rejects.toThrow('EACCES')
      readdirSpy.mockRestore()
    })

    it('should throw non-ENOENT errors from readFile in getSecret', async () => {
      delete process.env.CREDENTIAL_SECRET
      _resetSecretCache()

      const readFileSpy = vi.spyOn(_fs, 'readFile').mockImplementation(async (path) => {
        if (typeof path === 'string' && path.endsWith('.user-secret')) {
          const err = new Error('EACCES')
          ;(err as any).code = 'EACCES'
          throw err
        }
        return fsPromises.readFile(path, 'utf-8')
      })

      await expect(_getSecret()).rejects.toThrow('EACCES')
      readFileSpy.mockRestore()
    })
  })

  describe('loadAll edge cases', () => {
    it('should skip corrupted credential entries', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Store a valid entry
      await storeUserCredentials('good-user', [makeAccount('good@gmail.com')])

      // Create a corrupted entry
      const corruptDir = join(_paths.DATA_DIR, 'corrupted')
      mkdirSync(corruptDir, { recursive: true })
      const { writeFileSync } = await import('node:fs')
      writeFileSync(join(corruptDir, 'credentials.enc'), 'not-encrypted-data')

      const all = await loadAllUserCredentials()

      // Should have the good entry but not the corrupted one
      expect(all.size).toBe(1)
      expect(all.get('good-user')![0]!.email).toBe('good@gmail.com')

      // Should have logged an error for the corrupted entry
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load credentials from corrupted'),
        expect.any(Error)
      )

      spy.mockRestore()
    })

    it('should skip directories without credentials.enc', async () => {
      // Store a valid entry
      await storeUserCredentials('valid-user', [makeAccount('valid@gmail.com')])

      // Create an empty directory (no credentials.enc)
      const emptyDir = join(_paths.DATA_DIR, 'empty-dir')
      mkdirSync(emptyDir, { recursive: true })

      const all = await loadAllUserCredentials()
      expect(all.size).toBe(1)
      expect(all.get('valid-user')).toBeDefined()
    })

    it('should skip non-directory entries', async () => {
      await storeUserCredentials('dir-user', [makeAccount('dir@gmail.com')])

      // Create a file in the DATA_DIR (not a directory)
      const { writeFileSync } = await import('node:fs')
      writeFileSync(join(_paths.DATA_DIR, 'random-file.txt'), 'not a dir')

      const all = await loadAllUserCredentials()
      expect(all.size).toBe(1)
    })

    it('should skip entries with missing userId in JSON', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const invalidDir = join(_paths.DATA_DIR, 'no-userid')
      mkdirSync(invalidDir, { recursive: true })

      // Manual encryption of invalid payload
      const secret = await _getSecret()
      const key = await _deriveKey(secret, 'no-userid')
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const payload = JSON.stringify({ accounts: [] }) // Missing userId
      const plaintext = new TextEncoder().encode(payload)
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
      const combined = Buffer.concat([iv, Buffer.from(encrypted)])
      const { writeFileSync } = await import('node:fs')
      writeFileSync(join(invalidDir, 'credentials.enc'), combined)

      const all = await loadAllUserCredentials()
      expect(all.has('no-userid')).toBe(false)
      spy.mockRestore()
    })

    it('should skip entries with non-array accounts in JSON', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const invalidDir = join(_paths.DATA_DIR, 'bad-accounts')
      mkdirSync(invalidDir, { recursive: true })

      // Manual encryption of invalid payload
      const secret = await _getSecret()
      const key = await _deriveKey(secret, 'bad-accounts')
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const payload = JSON.stringify({ userId: 'bad-accounts', accounts: 'not-an-array' })
      const plaintext = new TextEncoder().encode(payload)
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
      const combined = Buffer.concat([iv, Buffer.from(encrypted)])
      const { writeFileSync } = await import('node:fs')
      writeFileSync(join(invalidDir, 'credentials.enc'), combined)

      const all = await loadAllUserCredentials()
      expect(all.has('bad-accounts')).toBe(false)
      spy.mockRestore()
    })

    it('should skip entries with invalid server config in JSON', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const invalidDir = join(_paths.DATA_DIR, 'bad-server')
      mkdirSync(invalidDir, { recursive: true })

      // Manual encryption of invalid payload (missing imap.port)
      const secret = await _getSecret()
      const key = await _deriveKey(secret, 'bad-server')
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const payload = JSON.stringify({
        userId: 'bad-server',
        accounts: [
          {
            id: '1',
            email: 'a@b.com',
            password: 'p',
            imap: { host: 'h', secure: true }, // missing port
            smtp: { host: 'h', port: 1, secure: true }
          }
        ]
      })
      const plaintext = new TextEncoder().encode(payload)
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
      const combined = Buffer.concat([iv, Buffer.from(encrypted)])
      const { writeFileSync } = await import('node:fs')
      writeFileSync(join(invalidDir, 'credentials.enc'), combined)

      const all = await loadAllUserCredentials()
      expect(all.has('bad-server')).toBe(false)
      spy.mockRestore()
    })
  })

  describe('load validation', () => {
    it('should throw when loading individual user with malformed data', async () => {
      const userId = 'malformed-user'
      const dirHash = hashUserId(userId)
      const userDir = join(_paths.DATA_DIR, dirHash)
      mkdirSync(userDir, { recursive: true })

      const secret = await _getSecret()
      const key = await _deriveKey(secret, dirHash)
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const payload = JSON.stringify({ userId, accounts: [{ email: 'missing-fields' }] })
      const plaintext = new TextEncoder().encode(payload)
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
      const combined = Buffer.concat([iv, Buffer.from(encrypted)])
      const { writeFileSync } = await import('node:fs')
      writeFileSync(join(userDir, 'credentials.enc'), combined)

      await expect(loadUserCredentials(userId)).rejects.toThrow('Invalid account configuration')
    })
  })
})
