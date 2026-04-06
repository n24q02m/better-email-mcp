/**
 * Non-blocking credential state management for better-email-mcp.
 *
 * State machine: awaiting_setup -> setup_in_progress -> configured
 * Reset: configured -> awaiting_setup (via explicit reset)
 *
 * Unlike wet-mcp, email has NO local fallback -- all tools need credentials.
 * When state is AWAITING_SETUP, tools return a clear error with setup URL.
 *
 * Key constraint: MCP `initialize` must respond within 1 second.
 * resolveCredentialState() is synchronous-fast (<10ms) -- it only reads env
 * vars and the encrypted config file on disk. The relay session (network I/O)
 * is deferred to triggerRelaySetup(), which runs non-blocking in the background.
 */

import { resolveConfig } from '@n24q02m/mcp-relay-core/storage'

const SERVER_NAME = 'better-email-mcp'
const DEFAULT_RELAY_URL = 'https://better-email-mcp.n24q02m.com'
const REQUIRED_FIELDS = ['EMAIL_CREDENTIALS']

export type CredentialState = 'awaiting_setup' | 'setup_in_progress' | 'configured'

let state: CredentialState = 'awaiting_setup'
let setupUrl: string | null = null

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
    const { existsSync, readFileSync } = await import('node:fs')
    const { homedir } = await import('node:os')
    const { join } = await import('node:path')
    const tokenFile = join(homedir(), '.better-email-mcp', 'tokens.json')
    if (existsSync(tokenFile)) {
      const data = readFileSync(tokenFile, 'utf-8')
      const store: Record<string, unknown> = JSON.parse(data)
      const emails = Object.keys(store).filter((key) => key.includes('@'))
      if (emails.length > 0) {
        const credentials = emails.map((email) => `${email}:oauth2`).join(',')
        process.env.EMAIL_CREDENTIALS = credentials
        console.error(`Found saved OAuth2 tokens for: ${emails.join(', ')}`)
        state = 'configured'
        return state
      }
    }
  } catch {
    // Token read failed, continue
  }

  // 4. Nothing found
  console.error('No credentials found -- server starting in awaiting_setup mode')
  state = 'awaiting_setup'
  return state
}

/**
 * Trigger relay session for credential setup.
 * Non-blocking: returns the setup URL immediately, polls in background.
 *
 * When the user submits credentials via the relay page, the background poll
 * picks them up, saves to config file, applies to env, and transitions
 * state to 'configured'. Subsequent tool calls will then work normally.
 */
export async function triggerRelaySetup(options?: { force?: boolean }): Promise<string | null> {
  if (!options?.force && state !== 'awaiting_setup') {
    return setupUrl
  }

  state = 'setup_in_progress'

  try {
    const { createSession } = await import('@n24q02m/mcp-relay-core')
    const { RELAY_SCHEMA } = await import('./relay-schema.js')

    const relayBase = process.env.MCP_RELAY_URL ?? DEFAULT_RELAY_URL

    const session = await createSession(relayBase, SERVER_NAME, RELAY_SCHEMA)
    setupUrl = session.relayUrl

    console.error(`\nSetup required. Open this URL to configure:\n${session.relayUrl}\n`)

    // Start background poll (non-blocking)
    pollRelayBackground(relayBase, session).catch(() => {})

    return setupUrl
  } catch {
    console.error(
      `Cannot reach relay server. Set EMAIL_CREDENTIALS manually.\nFormat: email1:password1,email2:password2`
    )
    state = 'awaiting_setup'
    return null
  }
}

/**
 * Background task that polls relay and applies config when user submits.
 * Handles the full post-relay flow including Outlook OAuth device code.
 */
async function pollRelayBackground(relayBase: string, session: any): Promise<void> {
  try {
    const { pollForResult, writeConfig } = await import('@n24q02m/mcp-relay-core')
    const { formatCredentials } = await import('./relay-setup.js')

    const config = await pollForResult(relayBase, session)

    // Save to config file for future use
    await writeConfig(SERVER_NAME, config)
    console.error('Email config saved successfully')

    const credentials = formatCredentials(config)
    process.env.EMAIL_CREDENTIALS = credentials

    // Handle Outlook OAuth device code (same logic as old relay-setup.ts)
    await handlePostRelayOAuth(relayBase, session, credentials)

    state = 'configured'
    console.error('Relay config applied -- credentials are now active')
  } catch (err: any) {
    if (String(err?.message).includes('RELAY_SKIPPED')) {
      console.error('Relay setup skipped by user. Email tools will be unavailable.')
    } else {
      console.error('Relay setup timed out or session expired. Email tools will be unavailable.')
    }
    state = 'awaiting_setup'
  }
}

/**
 * Post-relay OAuth handling for Outlook accounts.
 * Triggers device code flow and sends the code to the relay page for the user.
 */
async function handlePostRelayOAuth(relayBase: string, session: any, credentials: string): Promise<void> {
  try {
    const { parseCredentials } = await import('./tools/helpers/config.js')
    const { isOutlookDomain, ensureValidToken, _getPendingAuths } = await import('./tools/helpers/oauth2.js')
    const { sendMessage } = await import('@n24q02m/mcp-relay-core')

    const accounts = await parseCredentials(credentials)
    let hasOAuthPending = false

    await Promise.all(
      accounts.map(async (account) => {
        if (isOutlookDomain(account.email) && !account.oauth2) {
          try {
            await ensureValidToken(account)
          } catch (err: any) {
            const message = err?.message || ''
            const urlMatch = message.match(/Visit:\s*(https?:\/\/\S+)/)
            const codeMatch = message.match(/Enter code:\s*(\S+)/)
            if (urlMatch && codeMatch) {
              hasOAuthPending = true
              await sendMessage(relayBase, session.sessionId, {
                type: 'oauth_device_code',
                text: `Sign in to Microsoft for ${account.email}`,
                data: { url: urlMatch[1], code: codeMatch[1], email: account.email }
              }).catch(() => {})
              console.error(`OAuth device code sent to relay page for ${account.email}`)
            }
          }
        }
      })
    )

    if (!hasOAuthPending) {
      await sendMessage(relayBase, session.sessionId, {
        type: 'complete',
        text: 'Setup complete! All accounts configured.'
      }).catch(() => {})
    } else {
      // Wait for OAuth background poll to complete (tokens saved to disk)
      const pendingAuths = _getPendingAuths()
      const deadline = Date.now() + 10 * 60 * 1000
      while (pendingAuths.size > 0 && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000))
      }
      await sendMessage(relayBase, session.sessionId, {
        type: 'complete',
        text:
          pendingAuths.size === 0
            ? 'Setup complete! All accounts configured including OAuth.'
            : 'Credentials saved. OAuth sign-in may still be in progress.'
      }).catch(() => {})
    }
  } catch {
    // Best-effort OAuth handling -- credentials are already saved
    try {
      const { sendMessage } = await import('@n24q02m/mcp-relay-core')
      await sendMessage(relayBase, session.sessionId, {
        type: 'info',
        text: 'Credentials saved. If you added Outlook accounts, check back later for OAuth sign-in.'
      }).catch(() => {})
    } catch {
      // Ignore
    }
  }
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
    const { deleteConfig } = await import('@n24q02m/mcp-relay-core')
    await deleteConfig(SERVER_NAME)
  } catch {
    // Ignore
  }
}
