/**
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
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AccountConfig } from '../tools/helpers/config.js'

const DATA_DIR = join(homedir(), '.better-email-mcp', 'users')
const SECRET_PATH = join(homedir(), '.better-email-mcp', '.user-secret')

/** Exposed for testing -- override storage paths */
export const _paths = { DATA_DIR, SECRET_PATH }

function getSecret(): string {
  const parentDir = join(_paths.DATA_DIR, '..')
  if (!existsSync(parentDir)) mkdirSync(parentDir, { recursive: true, mode: 0o700 })

  const envSecret = process.env.CREDENTIAL_SECRET
  if (envSecret) return envSecret

  if (existsSync(_paths.SECRET_PATH)) return readFileSync(_paths.SECRET_PATH, 'utf-8').trim()

  const secret = randomBytes(32).toString('hex')
  writeFileSync(_paths.SECRET_PATH, secret, { mode: 0o600 })
  return secret
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, [
    'deriveKey'
  ])
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: new TextEncoder().encode('mcp-email-per-user'),
      iterations: 100_000
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
  if (!existsSync(userDir)) mkdirSync(userDir, { recursive: true, mode: 0o700 })

  const key = await deriveKey(getSecret())
  const iv = crypto.getRandomValues(new Uint8Array(12))

  // Store userId alongside accounts so we can reconstruct the mapping on loadAll()
  const payload = JSON.stringify({ userId, accounts })
  const plaintext = new TextEncoder().encode(payload)
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  const combined = Buffer.concat([iv, Buffer.from(encrypted)])

  writeFileSync(join(userDir, 'credentials.enc'), combined, { mode: 0o600 })
}

/**
 * Load per-user email account configs from disk.
 * Returns null if no credentials stored for this user.
 */
export async function loadUserCredentials(userId: string): Promise<AccountConfig[] | null> {
  const dirHash = hashUserId(userId)
  const credPath = join(_paths.DATA_DIR, dirHash, 'credentials.enc')

  if (!existsSync(credPath)) return null

  const data = readFileSync(credPath)
  const iv = data.subarray(0, 12)
  const ciphertext = data.subarray(12)
  const key = await deriveKey(getSecret())
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    key,
    new Uint8Array(ciphertext)
  )
  const parsed = JSON.parse(new TextDecoder().decode(decrypted))
  return parsed.accounts as AccountConfig[]
}

/**
 * Load all stored user credentials.
 * Returns a map of userId -> AccountConfig[].
 * Used on startup to restore the userAccounts map.
 */
export async function loadAllUserCredentials(): Promise<Map<string, AccountConfig[]>> {
  const result = new Map<string, AccountConfig[]>()

  if (!existsSync(_paths.DATA_DIR)) return result

  const entries = readdirSync(_paths.DATA_DIR, { withFileTypes: true })
  const key = await deriveKey(getSecret())

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const credPath = join(_paths.DATA_DIR, entry.name, 'credentials.enc')
    if (!existsSync(credPath)) continue

    try {
      const data = readFileSync(credPath)
      const iv = data.subarray(0, 12)
      const ciphertext = data.subarray(12)
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        key,
        new Uint8Array(ciphertext)
      )
      const parsed = JSON.parse(new TextDecoder().decode(decrypted))
      if (parsed.userId && Array.isArray(parsed.accounts)) {
        result.set(parsed.userId, parsed.accounts)
      }
    } catch (err) {
      // Skip corrupted entries -- log and continue
      console.error(`Failed to load credentials from ${entry.name}:`, err)
    }
  }

  return result
}

/**
 * Delete stored credentials for a specific user.
 */
export async function deleteUserCredentials(userId: string): Promise<void> {
  const dirHash = hashUserId(userId)
  const userDir = join(_paths.DATA_DIR, dirHash)

  if (existsSync(userDir)) {
    rmSync(userDir, { recursive: true, force: true })
  }
}
