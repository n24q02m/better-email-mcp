/**
 * Config schema for the relay credential form.
 *
 * The form is rendered by mcp-core's shared `renderCredentialForm` via the
 * schema-level `cardGroup` capability (added in mcp-core 1.20.0). Each card is
 * one email account; the core renderer handles Add/Remove, per-card field
 * cloning, and the Outlook-style device-code follow-up. On submit the form
 * POSTs a JSON array under the `accounts` key:
 *   { accounts: [ { email, password, imap_host, imap_port }, ... ] }
 * The server (`transports/http.ts` -> `assembleEmailCredentials`) reassembles
 * that array into the `EMAIL_CREDENTIALS` string the rest of the codebase
 * consumes, applying the Outlook domain-detect + device-code trigger.
 */

import type { RelayConfigSchema } from '@n24q02m/mcp-core'

export const RELAY_SCHEMA: RelayConfigSchema = {
  server: 'better-email-mcp',
  displayName: 'Email MCP',
  description:
    'Configure one or more email accounts (Gmail, Yahoo, iCloud, Outlook/Hotmail/Live, or custom IMAP). Outlook/Hotmail/Live accounts use OAuth2 and are handled automatically by the server after you submit — leave their password blank.',
  cardGroup: {
    key: 'accounts',
    itemLabel: 'Account',
    heading: 'Email Accounts',
    addButtonLabel: '+ Add Another Account',
    minItems: 1,
    titleField: 'email',
    fields: [
      {
        key: 'email',
        label: 'Email Address',
        type: 'email',
        required: true,
        placeholder: 'you@example.com'
      },
      {
        // Optional so Outlook/Hotmail/Live accounts (email-only, OAuth device
        // code) still pass form validation. The server drops the password for
        // Outlook domains and validates IMAP login for the rest.
        key: 'password',
        label: 'Password',
        type: 'password',
        required: false,
        helpText:
          'App Password for Gmail/Yahoo/iCloud (not your normal password). Leave blank for Outlook/Hotmail/Live — OAuth runs automatically after submit.'
      },
      {
        key: 'imap_host',
        label: 'IMAP Host',
        type: 'text',
        required: false,
        helpText: 'Optional. Leave empty for auto-detection. Accepts localhost or a proxy host.'
      },
      {
        key: 'imap_port',
        label: 'IMAP Port',
        type: 'text',
        required: false,
        placeholder: '993',
        helpText: 'Optional. Default 993. Set a custom port for a local IMAP proxy.'
      }
    ]
  }
}
