/**
 * @deprecated v1.0.0 -- disk-encrypted AES-GCM+PBKDF2 storage replaced by
 * `InMemoryCredStore` (TC-NearZK trust class). Module retained for one
 * minor release as migration shim; production callers (`spawn-setup.ts` +
 * `transports/http.ts`) now use `credStore` from `spawn-setup.ts`.
 * Removed in v2.0.0.
 *
 * See ~/projects/.superpower/mcp-core/specs/2026-04-30-trust-model-alignment.md
 * § 4.D3 + § 5.A8.
 *
 * Per-user encrypted credential storage.
 *
 * Stores email credentials per user in separate encrypted files:
 *   data_dir/{tokenHash}/credentials.enc
 *
 * Uses AES-256-GCM encryption with a key derived via PBKDF2
 * from CREDENTIAL_SECRET env var or an auto-generated file secret.
 *
 * On startup, loadAll() restores the userAccounts map from all stored users.
 */

import { createHash, randomBytes } from 'node:crypto'
import * as fsPromises from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AccountConfig } from '../tools/helpers/config.js'

// Exporting fs for easier testing/mocking
export const _fs = {
  mkdir: fsPromises.mkdir,
  readdir: fsPromises.readdir,
  readFile: fsPromises.readFile,
  rm: fsPromises.rm,
  writeFile: fsPromises.writeFile
}

const DATA_DIR = join(homedir(), '.better-email-mcp', 'users')
const SECRET_PATH = join(homedir(), '.better-email-mcp', '.user-secret')

/** Exposed for testing -- override storage paths */
export const _paths = { DATA_DIR, SECRET_PATH }

/** Exposed for testing */
export async function _getSecret(): Promise<string> {
  return getSecret()
}

/** Exposed for testing */
export async function _deriveKey(secret: string, userId = ''): Promise<CryptoKey> {
  return deriveKey(secret, userId)
}

let secretPromise: Promise<string> | null = null

/**
 * Reset the cached secret promise.
 * Internal helper for testing when environment or file secrets change.
 */
export function _resetSecretCache(): void {
  secretPromise = null
}

/**
 * Get the credential secret, either from environment or a managed secret file.
 * Uses a promise lock to ensure the secret is only initialized once even if called concurrently.
 */
async function getSecret(): Promise<string> {
  if (secretPromise) return secretPromise

  secretPromise = (async () => {
    const parentDir = join(_paths.DATA_DIR, '..')
    try {
      await _fs.mkdir(parentDir, { recursive: true, mode: 0o700 })
    } catch (_err) {
      // Ignore directory creation errors (likely already exists)
    }

    const envSecret = process.env.CREDENTIAL_SECRET
    if (envSecret) return envSecret

    try {
      return (await _fs.readFile(_paths.SECRET_PATH, 'utf-8')).trim()
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err
    }

    const secret = randomBytes(32).toString('hex')
    await _fs.writeFile(_paths.SECRET_PATH, secret, { mode: 0o600 })
    return secret
  })()

  return secretPromise
}

async function deriveKey(secret: string, userId = ''): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, [
    'deriveKey'
  ])
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: new TextEncoder().encode(`mcp-email-per-user:${userId || 'default'}`),
      iterations: process.env.VITEST ? 1000 : 600_000
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/** Hash a userId to create a safe directory name */
export function hashUserId(userId: string): string {
  return createHash('sha256').update(userId).digest('hex').slice(0, 16)
}

/**
 * Store per-user email account configs encrypted on disk.
 */
export async function storeUserCredentials(userId: string, accounts: AccountConfig[]): Promise<void> {
  const dirHash = hashUserId(userId)
  const userDir = join(_paths.DATA_DIR, dirHash)
  try {
    await _fs.mkdir(userDir, { recursive: true, mode: 0o700 })
  } catch (_err) {
    // Ignore
  }

  const secret = await getSecret()
  const key = await deriveKey(secret, hashUserId(userId))
  const iv = crypto.getRandomValues(new Uint8Array(12))

  // Store userId alongside accounts so we can reconstruct the mapping on loadAll()
  const payload = JSON.stringify({ userId, accounts })
  const plaintext = new TextEncoder().encode(payload)
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  const combined = Buffer.concat([iv, Buffer.from(encrypted)])

  await _fs.writeFile(join(userDir, 'credentials.enc'), combined, { mode: 0o600 })
}

/**
 * Load per-user email account configs from disk.
 * Returns null if no credentials stored for this user.
 */
export async function loadUserCredentials(userId: string): Promise<AccountConfig[] | null> {
  const dirHash = hashUserId(userId)
  const credPath = join(_paths.DATA_DIR, dirHash, 'credentials.enc')

  try {
    const data = await _fs.readFile(credPath)
    const iv = data.subarray(0, 12)
    const ciphertext = data.subarray(12)
    const secret = await getSecret()
    const key = await deriveKey(secret, dirHash)
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      new Uint8Array(ciphertext)
    )
    const parsed = JSON.parse(new TextDecoder().decode(decrypted))
    return parsed.accounts as AccountConfig[]
  } catch (err: any) {
    if (err.code === 'ENOENT') return null
    throw err
  }
}

/**
 * Load all stored user credentials.
 * Returns a map of userId -> AccountConfig[].
 * Used on startup to restore the userAccounts map.
 */
export async function loadAllUserCredentials(): Promise<Map<string, AccountConfig[]>> {
  const result = new Map<string, AccountConfig[]>()

  let entries: any[]
  try {
    entries = (await _fs.readdir(_paths.DATA_DIR, { withFileTypes: true })) as any
  } catch (err: any) {
    if (err.code === 'ENOENT') return result
    throw err
  }

  const secret = await getSecret()

  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isDirectory()) return

      const entryName = entry.name
      const credPath = join(_paths.DATA_DIR, entryName, 'credentials.enc')
      try {
        const data = await _fs.readFile(credPath)
        const iv = data.subarray(0, 12)
        const ciphertext = data.subarray(12)
        const key = await deriveKey(secret, entryName)
        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: new Uint8Array(iv) },
          key,
          new Uint8Array(ciphertext)
        )
        const parsed = JSON.parse(new TextDecoder().decode(decrypted))
        if (parsed.userId && Array.isArray(parsed.accounts)) {
          result.set(parsed.userId, parsed.accounts)
        }
      } catch (err: any) {
        // Skip missing or corrupted entries
        if (err.code !== 'ENOENT') {
          console.error(`Failed to load credentials from ${entry.name}:`, err)
        }
      }
    })
  )

  return result
}

/**
 * Delete stored credentials for a specific user.
 */
export async function deleteUserCredentials(userId: string): Promise<void> {
  const dirHash = hashUserId(userId)
  const userDir = join(_paths.DATA_DIR, dirHash)

  await _fs.rm(userDir, { recursive: true, force: true })
}
