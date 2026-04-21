/**
 * Non-blocking credential state management for better-email-mcp.
 *
 * State machine: awaiting_setup -> setup_in_progress -> configured
 * Reset: configured -> awaiting_setup (via explicit reset)
 *
 * When no credentials are present, ``triggerRelaySetup()`` spawns a LOCAL
 * HTTP server via mcp-core ``runLocalServer`` with the SAME spawn options
 * used by the HTTP transports (see ``spawn-setup.ts``). The browser renders
 * the multi-account ``renderEmailCredentialForm`` with domain auto-detect
 * for Gmail/Yahoo/iCloud/custom IMAP + Outlook OAuth2 device code. All
 * three modes -- ``remote-relay``, ``local-relay``, ``stdio`` -- present
 * the same UI and execute the same parse + IMAP validation + Outlook
 * Device Code backend flow, per the ``relay_mode_ui_parity`` rule.
 *
 * The spawn is LOCAL-ONLY -- we never hit a remote relay URL from the
 * stdio fallback path. See ``~/.claude/skills/mcp-dev/references/mode-matrix.md``
 * section ``stdio proxy`` for the canonical rule.
 *
 * Key constraint: MCP ``initialize`` must respond within 1 second.
 * ``resolveCredentialState()`` is synchronous-fast (<10ms) -- it only
 * reads env vars and the encrypted config file on disk. The local server
 * spawn is deferred to ``triggerRelaySetup()``, called lazily on first
 * tool use.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { LocalServerHandle } from '@n24q02m/mcp-core'
import { tryOpenBrowser } from '@n24q02m/mcp-core'
import { resolveConfig } from '@n24q02m/mcp-core/storage'

const SERVER_NAME = 'better-email-mcp'
const REQUIRED_FIELDS = ['EMAIL_CREDENTIALS']

/** Grace window so the browser renders "Connected" before the spawn closes. */
const SPAWN_CLEANUP_MS = 5_000

export type CredentialState = 'awaiting_setup' | 'setup_in_progress' | 'configured'

let state: CredentialState = 'awaiting_setup'
let setupUrl: string | null = null
let activeHandle: LocalServerHandle | null = null

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

/**
 * Fast credential check. Called during server startup.
 *
 * Resolution order:
 * 1. ENV VARS -- EMAIL_CREDENTIALS already set
 * 2. CONFIG FILE -- encrypted config from previous relay setup
 * 3. SAVED OAUTH TOKENS -- Outlook tokens from previous session
 * 4. NOTHING -- state = awaiting_setup (server starts fast, relay triggered lazily)
 *
 * Returns new state. Takes <10ms (no network I/O).
 */
export async function resolveCredentialState(): Promise<CredentialState> {
  // 1. Check env vars
  if (process.env.EMAIL_CREDENTIALS) {
    state = 'configured'
    return state
  }

  // 2. Check encrypted config file
  try {
    const result = await resolveConfig(SERVER_NAME, REQUIRED_FIELDS)
    if (result.config !== null) {
      const { formatCredentials } = await import('./relay-setup.js')
      const credentials = formatCredentials(result.config)
      process.env.EMAIL_CREDENTIALS = credentials
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
      process.env.EMAIL_CREDENTIALS = credentials
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

/**
 * Lazy setup trigger. Spawns a local HTTP credential form on a random port
 * and returns its URL. Caller surfaces the URL to the user (stderr or tool
 * response). Non-blocking -- the user submits the form in their browser and
 * onCredentialsSaved persists to config.enc in the background.
 */
export async function triggerRelaySetup(options?: { force?: boolean }): Promise<string | null> {
  if (!options?.force && state !== 'awaiting_setup') {
    return setupUrl
  }

  state = 'setup_in_progress'

  try {
    const { runLocalServer } = await import('@n24q02m/mcp-core')
    const { buildRunLocalServerOptions } = await import('./spawn-setup.js')

    const baseOptions = buildRunLocalServerOptions({
      serverFactory: stubMcpFactory,
      port: 0,
      host: '127.0.0.1',
      mode: 'stdio'
    })

    // Wrap onCredentialsSaved to schedule spawn cleanup after a successful
    // save so the browser renders "Connected" before the local server goes
    // away. Wrapping (not replacing) preserves the shared parse + IMAP
    // validation + Outlook Device Code behaviour from spawn-setup.
    const originalOnSaved = baseOptions.onCredentialsSaved
    const handle = await runLocalServer(stubMcpFactory, {
      ...baseOptions,
      onCredentialsSaved: async (creds) => {
        const result = await originalOnSaved?.(creds)
        if (result === null || result === undefined) {
          setTimeout(() => {
            closeActiveHandle().catch(() => {})
          }, SPAWN_CLEANUP_MS)
        }
        return result ?? null
      }
    })

    activeHandle = handle
    setupUrl = `http://${handle.host}:${handle.port}/`

    if (!process.env.E2E_SETUP && !process.env.CI && !process.env.VITEST) {
      void tryOpenBrowser(setupUrl)
    }

    console.error(`\nSetup required. Open this URL to configure:\n${setupUrl}\n`)

    return setupUrl
  } catch (err) {
    console.error(`Relay setup failed: ${err}. Server continues in awaiting_setup.`)
    state = 'awaiting_setup'
    return null
  }
}

async function closeActiveHandle(): Promise<void> {
  const handle = activeHandle
  if (!handle) return
  activeHandle = null
  await handle.close().catch(() => {})
}

/**
 * Minimal MCP server factory for the setup-only spawn. The spawned server
 * exists solely to render the /authorize paste form; /mcp should never be
 * called against it. Returning an empty McpServer satisfies runLocalServer's
 * type signature without wiring any tools that would require credentials
 * we do not yet have.
 */
function stubMcpFactory(): McpServer {
  return new McpServer({ name: `${SERVER_NAME}-setup`, version: '0.0.0' })
}

/** For testing and setup tool actions. */
export function setState(newState: CredentialState): void {
  state = newState
}

/** Reset to awaiting_setup (used by setup reset action). */
export async function resetState(): Promise<void> {
  state = 'awaiting_setup'
  setupUrl = null
  await closeActiveHandle()
  try {
    const { deleteConfig } = await import('@n24q02m/mcp-core')
    await deleteConfig(SERVER_NAME)
  } catch {
    // Ignore
  }
}
