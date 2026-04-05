/**
 * Server-side encrypted credential storage.
 *
 * Credentials are encrypted with AES-256-GCM using a key derived via PBKDF2
 * from either CREDENTIAL_SECRET env var or an auto-generated file secret.
 * Stored at ~/.better-email-mcp/credentials.enc
 */

import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const DATA_DIR = join(homedir(), '.better-email-mcp')
const CREDS_PATH = join(DATA_DIR, 'credentials.enc')
const SECRET_PATH = join(DATA_DIR, '.secret')

// Hoist instances to reduce GC pressure and instantiation overhead
const TEXT_ENCODER = new TextEncoder()
const TEXT_DECODER = new TextDecoder()

/** Exposed for testing — override storage paths */
export const _paths = { DATA_DIR, CREDS_PATH, SECRET_PATH }

function getSecret(): string {
  if (!existsSync(_paths.DATA_DIR)) mkdirSync(_paths.DATA_DIR, { recursive: true, mode: 0o700 })

  const envSecret = process.env.CREDENTIAL_SECRET
  if (envSecret) return envSecret

  if (existsSync(_paths.SECRET_PATH)) return readFileSync(_paths.SECRET_PATH, 'utf-8').trim()

  const secret = randomBytes(32).toString('hex')
  writeFileSync(_paths.SECRET_PATH, secret, { mode: 0o600 })
  return secret
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey('raw', TEXT_ENCODER.encode(secret), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: TEXT_ENCODER.encode('mcp-email-creds'),
      iterations: 100_000
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function storeCredentials(creds: Record<string, string>): Promise<void> {
  if (!existsSync(_paths.DATA_DIR)) mkdirSync(_paths.DATA_DIR, { recursive: true, mode: 0o700 })
  const key = await deriveKey(getSecret())
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = TEXT_ENCODER.encode(JSON.stringify(creds))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  const combined = Buffer.concat([iv, Buffer.from(encrypted)])
  writeFileSync(_paths.CREDS_PATH, combined, { mode: 0o600 })
}

export async function loadCredentials(): Promise<Record<string, string> | null> {
  if (!existsSync(_paths.CREDS_PATH)) return null
  const data = readFileSync(_paths.CREDS_PATH)
  const iv = data.subarray(0, 12)
  const ciphertext = data.subarray(12)
  const key = await deriveKey(getSecret())
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    key,
    new Uint8Array(ciphertext)
  )
  return JSON.parse(TEXT_DECODER.decode(decrypted))
}

export async function deleteCredentials(): Promise<void> {
  if (existsSync(_paths.CREDS_PATH)) unlinkSync(_paths.CREDS_PATH)
}
