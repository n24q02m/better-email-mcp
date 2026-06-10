/**
 * Custom credential form for better-email-mcp.
 */

import type { RelayConfigSchema } from '@n24q02m/mcp-core'
import { FORM_CSS, renderFormHtml, renderFormScript } from './credential-form-templates.js'

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Render the custom email credential form: multi-account cards with
 * domain auto-detect + Add/Remove buttons + Outlook OAuth notice.
 */
export function renderEmailCredentialForm(
  _schema: RelayConfigSchema,
  options: { submitUrl: string; prefill?: Record<string, string> }
): string {
  const displayName = escapeHtml(_schema.displayName ?? _schema.server ?? 'Email MCP')
  const server = escapeHtml(_schema.server ?? 'better-email-mcp')
  const description = escapeHtml(
    _schema.description ??
      'Configure one or more email accounts (Gmail, Yahoo, iCloud, Outlook/Hotmail/Live, or custom IMAP). Outlook accounts use OAuth2 and are handled automatically by the server.'
  )
  const submitUrlJson = JSON.stringify(options.submitUrl).replace(/</g, '\\u003c')

  return renderFormHtml({
    displayName,
    server,
    description,
    css: FORM_CSS,
    script: renderFormScript(submitUrlJson)
  })
}
