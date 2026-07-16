/**
 * Relay config helpers for better-email-mcp.
 *
 * The live credential path is in `credential-state.ts` (stdio fallback
 * spawns a LOCAL `runLocalServer`; HTTP modes mount via `transports/http.ts`).
 * This module exposes:
 *  - `formatCredentials`: reads a STORED config blob (`{ EMAIL_CREDENTIALS }`
 *    or legacy per-field) back into the `EMAIL_CREDENTIALS` string.
 *  - `assembleEmailCredentials`: encodes the `accounts` array submitted by
 *    mcp-core's card-group credential form into that same string.
 */

import { isOutlookDomain } from './tools/helpers/oauth2.js'

/**
 * Format a stored relay config into the EMAIL_CREDENTIALS string.
 *
 * Supports two stored shapes:
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

/** One account card as submitted by mcp-core's card-group credential form. */
export interface EmailAccountCard {
  email?: string
  password?: string
  imap_host?: string
  imap_port?: string
}

/**
 * Encode the `accounts` array from the card-group credential form into the
 * comma-separated EMAIL_CREDENTIALS string. Mirrors the encoder that used to
 * live client-side in the forked `credential-form.ts`:
 *  - Outlook/Hotmail/Live: the email only (server runs the device-code flow;
 *    any password typed is ignored).
 *  - Others: `email:password[:imap_host[:imap_port]]`. The port is appended
 *    only when the host carries no colon of its own.
 * Cards without an email — and non-Outlook cards without a password — are
 * skipped, matching the fork's submit-time filter.
 */
export function assembleEmailCredentials(accounts: EmailAccountCard[] | undefined): string {
  if (!Array.isArray(accounts)) {
    return ''
  }
  const parts: string[] = []
  for (const account of accounts) {
    const email = (account?.email ?? '').trim()
    if (!email) {
      continue
    }
    if (isOutlookDomain(email)) {
      parts.push(email)
      continue
    }
    const password = account?.password ?? ''
    if (!password) {
      continue
    }
    const imapHost = (account?.imap_host ?? '').trim()
    if (imapHost) {
      const imapPort = (account?.imap_port ?? '').trim()
      const imapSpec = imapPort && !imapHost.includes(':') ? `${imapHost}:${imapPort}` : imapHost
      parts.push(`${email}:${password}:${imapSpec}`)
    } else {
      parts.push(`${email}:${password}`)
    }
  }
  return parts.join(',')
}
