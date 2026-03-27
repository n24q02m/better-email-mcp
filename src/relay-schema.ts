/**
 * Config schema for relay page setup.
 *
 * The relay page (pages/email/form.js) handles the dynamic multi-account
 * flow itself. This schema declares what the server expects back:
 * a single EMAIL_CREDENTIALS field in the format email1:pass1,email2:pass2.
 */

import type { RelayConfigSchema } from '@n24q02m/mcp-relay-core/schema'

export const RELAY_SCHEMA: RelayConfigSchema = {
  server: 'better-email-mcp',
  displayName: 'Email MCP',
  fields: [
    {
      key: 'EMAIL_CREDENTIALS',
      label: 'Email Credentials',
      type: 'text',
      placeholder: 'user@gmail.com:app-password',
      helpText: 'Format: email:password. Multiple accounts: email1:pass1,email2:pass2',
      required: true
    }
  ]
}
