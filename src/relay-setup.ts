/**
 * Credential resolution for better-email-mcp.
 *
 * Resolution order (relay only when ALL local sources are empty):
 * 1. ENV VARS          -- EMAIL_CREDENTIALS (checked by caller in init-server.ts)
 * 2. RELAY CONFIG      -- Saved from previous relay setup (~/.config/mcp/config.enc)
 * 3. LOCAL CREDENTIALS -- Saved OAuth2 tokens (~/.better-email-mcp/tokens.json)
 * 4. RELAY SETUP       -- Interactive, ONLY when steps 1-2-3 are ALL empty
 * 5. DEGRADED MODE     -- No email tools
 */

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { writeConfig } from '@n24q02m/mcp-relay-core'
import { createSession, pollForResult } from '@n24q02m/mcp-relay-core/relay'
import { resolveConfig } from '@n24q02m/mcp-relay-core/storage'
import { RELAY_SCHEMA } from './relay-schema.js'
import { parseCredentials } from './tools/helpers/config.js'
import { ensureValidToken, isOutlookDomain } from './tools/helpers/oauth2.js'

const SERVER_NAME = 'better-email-mcp'
const DEFAULT_RELAY_URL = 'https://better-email-mcp.n24q02m.com'
const REQUIRED_FIELDS = ['EMAIL_CREDENTIALS']

/** Path to saved Outlook OAuth2 tokens */
const TOKEN_FILE = join(homedir(), '.better-email-mcp', 'tokens.json')

/**
 * Check for saved OAuth2 tokens from a previous session.
 *
 * If tokens.json exists with valid entries, construct EMAIL_CREDENTIALS
 * from the stored email addresses. The password is set to "oauth2" as a
 * placeholder -- parseCredentials + isOutlookDomain will detect these as
 * OAuth2 accounts and use the saved tokens from disk.
 *
 * Returns EMAIL_CREDENTIALS string or null if no saved tokens.
 */
function checkSavedOAuthTokens(): string | null {
  try {
    if (!existsSync(TOKEN_FILE)) return null

    const data = readFileSync(TOKEN_FILE, 'utf-8')
    const store: Record<string, unknown> = JSON.parse(data)
    const emails = Object.keys(store).filter((key) => key.includes('@'))

    if (emails.length === 0) return null

    // Build EMAIL_CREDENTIALS from saved token emails.
    // Password "oauth2" is a placeholder -- Outlook accounts use OAuth2 tokens
    // loaded from disk by loadStoredTokens() in oauth2.ts.
    const credentials = emails.map((email) => `${email}:oauth2`).join(',')
    console.error(`Found saved OAuth2 tokens for: ${emails.join(', ')}`)
    return credentials
  } catch {
    return null
  }
}

/**
 * Format relay config into EMAIL_CREDENTIALS string.
 *
 * Supports two formats from the relay page:
 * - New (multi-account): { EMAIL_CREDENTIALS: "email1:pass1,email2:pass2" }
 * - Legacy (single account): { email, password, imap_host? }
 */
export function formatCredentials(config: Record<string, string>): string {
  // New format: relay page sends EMAIL_CREDENTIALS directly
  if (config.EMAIL_CREDENTIALS) {
    return config.EMAIL_CREDENTIALS
  }

  // Legacy format: individual fields from old relay page
  const { email, password, imap_host } = config
  if (!email || !password) {
    throw new Error('Relay config missing required fields: EMAIL_CREDENTIALS or email+password')
  }
  if (imap_host) {
    return `${email}:${password}:${imap_host}`
  }
  return `${email}:${password}`
}

/**
 * Resolve config: config file -> saved OAuth tokens -> relay setup -> degraded.
 *
 * Relay is ONLY triggered when steps 1-2-3 are ALL empty (first-time setup).
 *
 * Resolution order (env vars already checked by caller in init-server.ts):
 * 1. Encrypted config file (~/.config/mcp/config.enc)
 * 2. Saved OAuth2 tokens (~/.better-email-mcp/tokens.json)
 * 3. Relay setup (interactive, only when no local credentials exist)
 * 4. Degraded mode (no email tools)
 *
 * Returns the formatted EMAIL_CREDENTIALS string, or null for degraded mode.
 */
export async function ensureConfig(): Promise<string | null> {
  // 1. Check saved relay config file
  const result = await resolveConfig(SERVER_NAME, REQUIRED_FIELDS)
  if (result.config !== null) {
    console.error(`Email config loaded from ${result.source}`)
    return formatCredentials(result.config)
  }

  // 2. Check saved OAuth2 tokens (local credentials)
  const savedTokens = checkSavedOAuthTokens()
  if (savedTokens) {
    return savedTokens
  }

  // 3. No local credentials found -- trigger relay setup
  console.error('No email credentials found. Starting relay setup...')

  const relayUrl = DEFAULT_RELAY_URL
  let session: Awaited<ReturnType<typeof createSession>>
  try {
    session = await createSession(relayUrl, SERVER_NAME, RELAY_SCHEMA)
  } catch {
    console.error(
      `Cannot reach relay server at ${relayUrl}. Set EMAIL_CREDENTIALS manually.\nFormat: email1:password1,email2:password2`
    )
    return null
  }

  // Log URL to stderr (visible to user in MCP client)
  console.error(`\nSetup required. Open this URL to configure:\n${session.relayUrl}\n`)

  // Poll for result
  let config: Record<string, string>
  try {
    config = await pollForResult(relayUrl, session)
  } catch (err: any) {
    if (err?.message === 'RELAY_SKIPPED') {
      console.error('Relay setup skipped by user. Email tools will be unavailable.')
    } else {
      console.error('Relay setup timed out or session expired. Email tools will be unavailable.')
    }
    return null
  }

  // Save to config file for future use
  await writeConfig(SERVER_NAME, config)
  console.error('Email config saved successfully')

  const credentials = formatCredentials(config)

  // Check if any Outlook accounts need OAuth — send device code via relay messaging
  let hasOAuthPending = false
  try {
    const accounts = await parseCredentials(credentials)
    for (const account of accounts) {
      if (isOutlookDomain(account.email) && !account.oauth2) {
        try {
          await ensureValidToken(account)
        } catch (err: any) {
          // ensureValidToken throws with device code info — extract and send via relay
          const message = err?.message || ''
          const urlMatch = message.match(/Visit:\s*(https?:\/\/\S+)/)
          const codeMatch = message.match(/Enter code:\s*(\S+)/)
          if (urlMatch && codeMatch) {
            hasOAuthPending = true
            await fetch(`${relayUrl}/api/sessions/${session.sessionId}/messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'oauth_device_code',
                text: `Sign in to Microsoft for ${account.email}`,
                data: { url: urlMatch[1], code: codeMatch[1], email: account.email }
              })
            })
            console.error(`OAuth device code sent to relay page for ${account.email}`)
          }
        }
      }
    }

    if (!hasOAuthPending) {
      // No OAuth needed — all accounts ready
      await fetch(`${relayUrl}/api/sessions/${session.sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'complete',
          text: 'Setup complete! All accounts configured.'
        })
      })
    }
    // If OAuth pending: DON'T send complete yet.
    // The background poll in oauth2.ts will save tokens to disk.
    // Relay page stays open showing the device code.
  } catch {
    await fetch(`${relayUrl}/api/sessions/${session.sessionId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'info',
        text: 'Credentials saved. If you added Outlook accounts, check back later for OAuth sign-in.'
      })
    }).catch(() => {})
  }

  return credentials
}
