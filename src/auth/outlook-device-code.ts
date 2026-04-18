/**
 * Microsoft Outlook OAuth 2.0 Device Code upstream configuration for
 * `createDelegatedOAuthApp({flow:'device_code', upstream: ...})`.
 *
 * Scopes requested:
 *   - offline_access                                   -> refresh_token
 *   - https://outlook.office.com/IMAP.AccessAsUser.All -> IMAP mailbox
 *   - https://outlook.office.com/SMTP.Send             -> SMTP send
 */
import type { UpstreamOAuthConfig } from '@n24q02m/mcp-core'

export function buildOutlookUpstream(opts: { clientId: string }): UpstreamOAuthConfig {
  return {
    deviceAuthUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/devicecode',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    clientId: opts.clientId,
    scopes: [
      'offline_access',
      'https://outlook.office.com/IMAP.AccessAsUser.All',
      'https://outlook.office.com/SMTP.Send'
    ],
    pollIntervalMs: 5000
  }
}
