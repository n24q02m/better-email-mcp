import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountConfig } from '../tools/helpers/config.js'
import {
  _paths,
  _resetSecretCache,
  deleteUserCredentials,
  hashUserId,
  loadAllUserCredentials,
  loadUserCredentials,
  storeUserCredentials
} from './per-user-credential-store.js'

const makeAccount = (email: string): AccountConfig => ({
  id: email.replace(/[@.]/g, '_'),
  email,
  password: 'test-pass-123',
  authType: 'password',
  imap: { host: 'imap.gmail.com', port: 993, secure: true },
  smtp: { host: 'smtp.gmail.com', port: 465, secure: true }
})

describe('per-user-credential-store', () => {
  let originalDataDir: string
  let originalSecretPath: string
  let testDir: string

  beforeEach(() => {
    originalDataDir = _paths.DATA_DIR
    originalSecretPath = _paths.SECRET_PATH

    testDir = join(tmpdir(), `per-user-test-${randomBytes(4).toString('hex')}`)
    mkdirSync(testDir, { recursive: true })
    _paths.DATA_DIR = join(testDir, 'users')
    _paths.SECRET_PATH = join(testDir, '.user-secret')

    process.env.CREDENTIAL_SECRET = 'test-per-user-secret'
    _resetSecretCache()
  })

  afterEach(() => {
    _paths.DATA_DIR = originalDataDir
    _paths.SECRET_PATH = originalSecretPath
    delete process.env.CREDENTIAL_SECRET
    _resetSecretCache()

    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('hashUserId', () => {
    it('should return a 16-char hex string', () => {
      const hash = hashUserId('user-123')
      expect(hash).toHaveLength(16)
      expect(hash).toMatch(/^[0-9a-f]+$/)
    })

    it('should produce deterministic results', () => {
      expect(hashUserId('user-123')).toBe(hashUserId('user-123'))
    })

    it('should produce different hashes for different userIds', () => {
      expect(hashUserId('user-a')).not.toBe(hashUserId('user-b'))
    })
  })

  describe('store and load', () => {
    it('should return null when no credentials stored', async () => {
      const result = await loadUserCredentials('nonexistent-user')
      expect(result).toBeNull()
    })

    it('should store and load single account roundtrip', async () => {
      const accounts = [makeAccount('test@gmail.com')]
      await storeUserCredentials('user-1', accounts)

      const loaded = await loadUserCredentials('user-1')
      expect(loaded).toEqual(accounts)
    })

    it('should store and load multiple accounts roundtrip', async () => {
      const accounts = [makeAccount('a@gmail.com'), makeAccount('b@outlook.com')]
      await storeUserCredentials('user-2', accounts)

      const loaded = await loadUserCredentials('user-2')
      expect(loaded).toHaveLength(2)
      expect(loaded![0]!.email).toBe('a@gmail.com')
      expect(loaded![1]!.email).toBe('b@outlook.com')
    })

    it('should overwrite existing credentials for same user', async () => {
      await storeUserCredentials('user-3', [makeAccount('old@gmail.com')])
      await storeUserCredentials('user-3', [makeAccount('new@gmail.com')])

      const loaded = await loadUserCredentials('user-3')
      expect(loaded).toHaveLength(1)
      expect(loaded![0]!.email).toBe('new@gmail.com')
    })

    it('should isolate different users', async () => {
      await storeUserCredentials('alice', [makeAccount('alice@gmail.com')])
      await storeUserCredentials('bob', [makeAccount('bob@gmail.com')])

      const aliceAccounts = await loadUserCredentials('alice')
      const bobAccounts = await loadUserCredentials('bob')

      expect(aliceAccounts![0]!.email).toBe('alice@gmail.com')
      expect(bobAccounts![0]!.email).toBe('bob@gmail.com')
    })
  })

  describe('loadAll', () => {
    it('should return empty map when no users stored', async () => {
      const result = await loadAllUserCredentials()
      expect(result.size).toBe(0)
    })

    it('should load all stored users', async () => {
      await storeUserCredentials('user-a', [makeAccount('a@gmail.com')])
      await storeUserCredentials('user-b', [makeAccount('b@gmail.com')])
      await storeUserCredentials('user-c', [makeAccount('c@gmail.com')])

      const all = await loadAllUserCredentials()
      expect(all.size).toBe(3)
      expect(all.get('user-a')![0]!.email).toBe('a@gmail.com')
      expect(all.get('user-b')![0]!.email).toBe('b@gmail.com')
      expect(all.get('user-c')![0]!.email).toBe('c@gmail.com')
    })
  })

  describe('delete', () => {
    it('should delete stored credentials', async () => {
      await storeUserCredentials('user-del', [makeAccount('del@gmail.com')])
      expect(await loadUserCredentials('user-del')).not.toBeNull()

      await deleteUserCredentials('user-del')
      expect(await loadUserCredentials('user-del')).toBeNull()
    })

    it('should not throw when deleting non-existent user', async () => {
      await expect(deleteUserCredentials('nonexistent')).resolves.toBeUndefined()
    })

    it('should not affect other users', async () => {
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

      // Second store uses same secret
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

      // Delete the entire test dir and recreate it so the parent of DATA_DIR is missing
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true })
      }

      // Re-setup _paths since they are absolute
      // No need to mkdir(testDir) as getSecret should do it recursively

      const accounts = [makeAccount('recursive@gmail.com')]
      await storeUserCredentials('recursive-user', accounts)

      expect(existsSync(_paths.DATA_DIR)).toBe(true)
      const loaded = await loadUserCredentials('recursive-user')
      expect(loaded).toEqual(accounts)
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

    it('should skip entries with JSON parse failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const parseSpy = vi.spyOn(JSON, 'parse').mockImplementationOnce(() => {
        throw new Error('JSON parse error')
      })

      try {
        await storeUserCredentials('parse-fail-user', [makeAccount('fail@gmail.com')])

        const all = await loadAllUserCredentials()
        expect(all.size).toBe(0)
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed to load credentials'),
          expect.any(Error)
        )
      } finally {
        consoleSpy.mockRestore()
        parseSpy.mockRestore()
      }
    })

    it('should skip entries with missing required fields', async () => {
      const parseSpy = vi.spyOn(JSON, 'parse').mockImplementationOnce(() => ({
        userId: 'missing-accounts'
        // accounts is missing
      }))

      try {
        await storeUserCredentials('missing-fields-user', [makeAccount('missing@gmail.com')])

        const all = await loadAllUserCredentials()
        expect(all.size).toBe(0)
      } finally {
        parseSpy.mockRestore()
      }
    })

    it('should load valid users even if some are corrupted', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // 1. Valid user
      await storeUserCredentials('user-1', [makeAccount('user1@gmail.com')])

      // 2. Corrupted user (decryption failure)
      const corruptDir = join(_paths.DATA_DIR, 'corrupted')
      mkdirSync(corruptDir, { recursive: true })
      const { writeFileSync } = await import('node:fs')
      writeFileSync(join(corruptDir, 'credentials.enc'), Buffer.from('garbage'))

      // 3. User that will fail JSON parse
      await storeUserCredentials('user-fail-parse', [makeAccount('fail@gmail.com')])

      // 4. User that will miss fields
      await storeUserCredentials('user-missing-fields', [makeAccount('missing@gmail.com')])

      const originalParse = JSON.parse
      const parseSpy = vi.spyOn(JSON, 'parse').mockImplementation((text) => {
        // Only intercept if it looks like our payload
        if (text.includes('user-fail-parse') || text.includes('user-missing-fields')) {
          const obj = originalParse(text)
          if (obj.userId === 'user-fail-parse') {
            throw new Error('Mock JSON error')
          }
          if (obj.userId === 'user-missing-fields') {
            return { userId: 'user-missing-fields' } // Missing accounts
          }
          return obj
        }
        return originalParse(text)
      })

      try {
        const all = await loadAllUserCredentials()

        expect(all.size).toBe(1)
        expect(all.has('user-1')).toBe(true)
        expect(all.get('user-1')![0]!.email).toBe('user1@gmail.com')

        // Should have logged errors for decryption failure and parse failure
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed to load credentials'),
          expect.any(Error)
        )
      } finally {
        consoleSpy.mockRestore()
        parseSpy.mockRestore()
      }
    })
  })
})
