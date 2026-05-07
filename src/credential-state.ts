/**
 * Non-blocking credential state management for better-email-mcp.
 *
 * State machine: awaiting_setup -> setup_in_progress -> configured
 * Reset: configured -> awaiting_setup (via explicit reset)
 *
 * Setup flows:
 *  - stdio mode (default): credentials come from env vars
 *    (EMAIL_PROVIDER + EMAIL_USER + EMAIL_APP_PASSWORD), validated up-front in
 *    `init-server.ts`. No relay form spawn.
 *  - http mode (opt-in): credentials are pasted into the multi-account
 *    `renderEmailCredentialForm` served by `transports/http.ts`. The HTTP
 *    transport runs `runLocalServer` directly — there is no separate
 *    "trigger relay setup" path anymore (deleted 2026-05-01 per spec
 *    2026-05-01-stdio-pure-http-multiuser.md §5.2.1).
 *
 * Key constraint: MCP `initialize` must respond within 1 second.
 * `resolveCredentialState()` is synchronous-fast (<10ms) -- it only reads env
 * vars and the encrypted config file on disk.
 */

import { resolveConfig } from '@n24q02m/mcp-core/storage'

const SERVER_NAME = 'better-email-mcp'
const REQUIRED_FIELDS = ['EMAIL_CREDENTIALS']

export type CredentialState = 'awaiting_setup' | 'setup_in_progress' | 'configured'

let state: CredentialState = 'awaiting_setup'
let setupUrl: string | null = null

let resolvedCredentials: string | null = null

export function getCredentials(): string | null {
  return resolvedCredentials ?? process.env.EMAIL_CREDENTIALS ?? null
}

export function setCredentials(creds: string | null): void {
  resolvedCredentials = creds
}

// Hook supplied by the HTTP transport layer (mcp-core's local OAuth app)
// that lets background Outlook OAuth polls flip ``GET /setup-status`` to
// ``complete`` so the credential form stops spinning.
let markSetupCompleteFn: ((key?: string) => void) | null = null

export function setMarkSetupComplete(fn: ((key?: string) => void) | null): void {
  markSetupCompleteFn = fn
}

export function getMarkSetupComplete(): ((key?: string) => void) | null {
  return markSetupCompleteFn
}

export function getState(): CredentialState {
  return state
}

export function getSetupUrl(): string | null {
  return setupUrl
}

export function setSetupUrl(url: string | null): void {
  setupUrl = url
}

/**
 * Fast credential check. Called during server startup.
 *
 * Resolution order:
 * 1. ENV VARS -- EMAIL_CREDENTIALS already set
 * 2. CONFIG FILE -- encrypted config from previous relay setup
 * 3. SAVED OAUTH TOKENS -- Outlook tokens from previous session
 * 4. NOTHING -- state = awaiting_setup (server starts; HTTP form serves /authorize)
 *
 * Returns new state. Takes <10ms (no network I/O).
 */
export async function resolveCredentialState(): Promise<CredentialState> {
  // 1. Check env vars (legacy combined form OR stdio per-field form)
  if (getCredentials()) {
    state = 'configured'
    return state
  }

  // 1b. stdio per-field env vars (set by plugin config) — synthesize the
  // combined EMAIL_CREDENTIALS string the rest of the codebase expects.
  if (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
    setCredentials(`${process.env.EMAIL_USER}:${process.env.EMAIL_APP_PASSWORD}`)
    state = 'configured'
    return state
  }

  // 2. Check encrypted config file
  try {
    const result = await resolveConfig(SERVER_NAME, REQUIRED_FIELDS)
    if (result.config !== null) {
      const { formatCredentials } = await import('./relay-setup.js')
      const credentials = formatCredentials(result.config)
      setCredentials(credentials)
      console.error(`Email config loaded from ${result.source}`)
      state = 'configured'
      return state
    }
  } catch {
    // Config read failed, continue
  }

  // 3. Check saved OAuth2 tokens (from relay-setup's checkSavedOAuthTokens logic)
  try {
    const { readFile } = await import('node:fs/promises')
    const { homedir } = await import('node:os')
    const { join } = await import('node:path')
    const tokenFile = join(homedir(), '.better-email-mcp', 'tokens.json')

    const data = await readFile(tokenFile, 'utf-8')
    const store: Record<string, unknown> = JSON.parse(data)
    const emails = Object.keys(store).filter((key) => key.includes('@'))
    if (emails.length > 0) {
      const credentials = emails.map((email) => `${email}:oauth2`).join(',')
      setCredentials(credentials)
      console.error(`Found saved OAuth2 tokens for: ${emails.join(', ')}`)
      state = 'configured'
      return state
    }
  } catch (_err) {
    // Token read failed or file doesn't exist, continue
  }

  // 4. Nothing found
  console.error('No credentials found -- server starting in awaiting_setup mode')
  state = 'awaiting_setup'
  return state
}

/** For testing and setup tool actions. */
export function setState(newState: CredentialState): void {
  state = newState
}

/** Reset to awaiting_setup (used by setup reset action). */
export async function resetState(): Promise<void> {
  state = 'awaiting_setup'
  setupUrl = null
  try {
    const { deleteConfig } = await import('@n24q02m/mcp-core')
    await deleteConfig(SERVER_NAME)
    setCredentials(null)
  } catch {
    // Ignore
  }
}
