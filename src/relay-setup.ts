/**
 * Relay-first setup flow for better-email-mcp.
 *
 * Always shows the relay URL at startup so users can configure email
 * credentials via browser. If the user skips, the server starts in
 * degraded mode (help tool only).
 *
 * Resolution order:
 * 1. Environment variables (EMAIL_CREDENTIALS -- checked by caller)
 * 2. Encrypted config file (~/.config/mcp/config.enc)
 * 3. Relay setup (browser-based form via relay server)
 * 4. Saved OAuth2 tokens (~/.better-email-mcp/tokens.json)
 * 5. Degraded mode (no email tools)
 */

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { writeConfig } from '@n24q02m/mcp-relay-core'
import { createSession, pollForResult } from '@n24q02m/mcp-relay-core/relay'
import { resolveConfig } from '@n24q02m/mcp-relay-core/storage'
import { RELAY_SCHEMA } from './relay-schema.js'

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
 * Resolve config or trigger relay setup (relay-first design).
 *
 * Resolution order:
 * 1. Encrypted config file (~/.config/mcp/config.enc)
 * 2. Relay setup (browser-based form via relay server)
 * 3. Saved OAuth2 tokens (~/.better-email-mcp/tokens.json)
 *
 * Returns the formatted EMAIL_CREDENTIALS string, or null if setup
 * fails/times out/skipped AND no saved tokens exist.
 *
 * Note: Environment variables are NOT checked here -- loadConfig() in
 * init-server.ts already handles that. This function is only called
 * when EMAIL_CREDENTIALS is not set.
 */
export async function ensureConfig(): Promise<string | null> {
  // Check config file
  const result = await resolveConfig(SERVER_NAME, REQUIRED_FIELDS)
  if (result.config !== null) {
    console.error(`Email config loaded from ${result.source}`)
    return formatCredentials(result.config)
  }

  // No config found -- always trigger relay setup (relay-first)
  console.error('No email credentials found. Starting relay setup...')

  const relayUrl = DEFAULT_RELAY_URL
  let session: Awaited<ReturnType<typeof createSession>>
  try {
    session = await createSession(relayUrl, SERVER_NAME, RELAY_SCHEMA)
  } catch {
    console.error(
      `Cannot reach relay server at ${relayUrl}. Set EMAIL_CREDENTIALS manually.\nFormat: email1:password1,email2:password2`
    )
    // Fall through to saved token check
    return checkSavedOAuthTokens()
  }

  // Log URL to stderr (visible to user in MCP client)
  console.error(`\nSetup required. Open this URL to configure:\n${session.relayUrl}\n`)

  // Poll for result
  let config: Record<string, string>
  try {
    config = await pollForResult(relayUrl, session)
  } catch (err: any) {
    if (err?.message === 'RELAY_SKIPPED') {
      console.error('Relay setup skipped by user.')
      // Check for saved OAuth tokens before degrading
      const savedTokens = checkSavedOAuthTokens()
      if (!savedTokens) {
        console.error('No saved OAuth tokens found. Email tools will be unavailable.')
      }
      return savedTokens
    }
    console.error('Relay setup timed out or session expired.')
    // Check for saved OAuth tokens before degrading
    const savedTokens = checkSavedOAuthTokens()
    if (!savedTokens) {
      console.error('No saved OAuth tokens found. Email tools will be unavailable.')
    }
    return savedTokens
  }

  // Save to config file for future use
  await writeConfig(SERVER_NAME, config)
  console.error('Email config saved successfully')

  return formatCredentials(config)
}
