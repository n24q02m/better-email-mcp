/**
 * OAuth Token Storage
 * Encrypted file-based storage for OAuth tokens using AES-256-GCM
 * Storage path: ~/.config/better-email-mcp/
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const CONFIG_DIR = join(homedir(), '.config', 'better-email-mcp')
const ACCOUNTS_DIR = join(CONFIG_DIR, 'accounts')
const CLIENT_CONFIG_FILE = join(CONFIG_DIR, 'oauth-clients.json')

/** Encryption algorithm */
const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16
const SALT_LENGTH = 32

export interface StoredTokens {
  email: string
  provider: string
  accessToken: string
  refreshToken: string
  tokenExpiry: number
  scopes: string[]
  createdAt: string
  updatedAt: string
}

export interface OAuthClientConfig {
  provider: string
  clientId: string
  clientSecret: string
}

/**
 * Derive encryption key from a passphrase using scrypt
 * Uses machine-specific data as part of the key derivation
 */
function deriveKey(salt: Buffer): Buffer {
  const passphrase = `better-email-mcp:${homedir()}:${process.arch}`
  return scryptSync(passphrase, salt, KEY_LENGTH)
}

/**
 * Encrypt a string value
 */
function encrypt(plaintext: string): string {
  const salt = randomBytes(SALT_LENGTH)
  const key = deriveKey(salt)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const tag = cipher.getAuthTag()

  // Format: salt:iv:tag:encrypted (all hex)
  return `${salt.toString('hex')}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`
}

/**
 * Decrypt a string value
 */
function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':')
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted data format')
  }

  const salt = Buffer.from(parts[0]!, 'hex')
  const iv = Buffer.from(parts[1]!, 'hex')
  const tag = Buffer.from(parts[2]!, 'hex')
  const encrypted = parts[3]!

  const key = deriveKey(salt)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

/**
 * Ensure config directories exist
 */
function ensureDirs(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }
  if (!existsSync(ACCOUNTS_DIR)) {
    mkdirSync(ACCOUNTS_DIR, { recursive: true })
  }
}

/**
 * Convert email to safe filename
 */
function emailToFilename(email: string): string {
  return `${email.replace(/[@.]/g, '_').toLowerCase()}.json`
}

// ============================================================================
// Public API - Token Storage
// ============================================================================

/**
 * Save OAuth tokens for an email account (encrypted)
 */
export function saveTokens(tokens: StoredTokens): void {
  ensureDirs()
  const filename = emailToFilename(tokens.email)
  const filepath = join(ACCOUNTS_DIR, filename)

  const data = {
    email: tokens.email,
    provider: tokens.provider,
    accessToken: encrypt(tokens.accessToken),
    refreshToken: encrypt(tokens.refreshToken),
    tokenExpiry: tokens.tokenExpiry,
    scopes: tokens.scopes,
    createdAt: tokens.createdAt,
    updatedAt: new Date().toISOString()
  }

  writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8')
}

/**
 * Load OAuth tokens for an email account (decrypted)
 */
export function loadTokens(email: string): StoredTokens | null {
  const filename = emailToFilename(email)
  const filepath = join(ACCOUNTS_DIR, filename)

  if (!existsSync(filepath)) return null

  try {
    const raw = JSON.parse(readFileSync(filepath, 'utf-8'))
    return {
      email: raw.email,
      provider: raw.provider,
      accessToken: decrypt(raw.accessToken),
      refreshToken: decrypt(raw.refreshToken),
      tokenExpiry: raw.tokenExpiry,
      scopes: raw.scopes,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt
    }
  } catch {
    return null
  }
}

/**
 * Delete stored tokens for an email account
 */
export function deleteTokens(email: string): boolean {
  const filename = emailToFilename(email)
  const filepath = join(ACCOUNTS_DIR, filename)

  if (!existsSync(filepath)) return false

  unlinkSync(filepath)
  return true
}

/**
 * List all stored OAuth accounts
 */
export function listStoredAccounts(): string[] {
  ensureDirs()
  return readdirSync(ACCOUNTS_DIR)
    .filter((f: string) => f.endsWith('.json'))
    .map((f: string) => {
      try {
        const raw = JSON.parse(readFileSync(join(ACCOUNTS_DIR, f), 'utf-8'))
        return raw.email as string
      } catch {
        return null
      }
    })
    .filter(Boolean) as string[]
}

/**
 * Check if OAuth tokens exist for an email account
 */
export function hasTokens(email: string): boolean {
  const filename = emailToFilename(email)
  const filepath = join(ACCOUNTS_DIR, filename)
  return existsSync(filepath)
}

// ============================================================================
// Public API - OAuth Client Config
// ============================================================================

/**
 * Save OAuth client credentials for a provider
 */
export function saveClientConfig(config: OAuthClientConfig): void {
  ensureDirs()
  let configs: Record<string, OAuthClientConfig> = {}

  if (existsSync(CLIENT_CONFIG_FILE)) {
    try {
      configs = JSON.parse(readFileSync(CLIENT_CONFIG_FILE, 'utf-8'))
    } catch {
      configs = {}
    }
  }

  // Store client_secret encrypted
  configs[config.provider] = {
    provider: config.provider,
    clientId: config.clientId,
    clientSecret: encrypt(config.clientSecret)
  }

  writeFileSync(CLIENT_CONFIG_FILE, JSON.stringify(configs, null, 2), 'utf-8')
}

/**
 * Load OAuth client credentials for a provider
 */
export function loadClientConfig(provider: string): OAuthClientConfig | null {
  if (!existsSync(CLIENT_CONFIG_FILE)) return null

  try {
    const configs = JSON.parse(readFileSync(CLIENT_CONFIG_FILE, 'utf-8'))
    const config = configs[provider]
    if (!config) return null

    return {
      provider: config.provider,
      clientId: config.clientId,
      clientSecret: decrypt(config.clientSecret)
    }
  } catch {
    return null
  }
}

/**
 * Get the config directory path (for display purposes)
 */
export function getConfigDir(): string {
  return CONFIG_DIR
}
