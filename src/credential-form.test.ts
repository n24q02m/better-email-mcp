import type { RelayConfigSchema } from '@n24q02m/mcp-core'
import { describe, expect, it } from 'vitest'

import { renderEmailCredentialForm } from './credential-form.js'

const schema: RelayConfigSchema = {
  server: 'better-email-mcp',
  displayName: 'Email MCP',
  fields: []
}

describe('renderEmailCredentialForm', () => {
  it('returns complete HTML document', () => {
    const html = renderEmailCredentialForm(schema, { submitUrl: '/authorize?nonce=abc' })
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Email MCP')
  })

  it('includes account container and Add Account button', () => {
    const html = renderEmailCredentialForm(schema, { submitUrl: '/auth' })
    expect(html).toMatch(/accounts-container|account-card/i)
    expect(html).toContain('Add Another Account')
  })

  it('includes domain auto-detect JS for gmail', () => {
    const html = renderEmailCredentialForm(schema, { submitUrl: '/auth' })
    expect(html).toContain('gmail.com')
    expect(html).toContain('myaccount.google.com/apppasswords')
  })

  it('includes Outlook domains list', () => {
    const html = renderEmailCredentialForm(schema, { submitUrl: '/auth' })
    expect(html).toContain('outlook.com')
    expect(html).toContain('hotmail.com')
    expect(html).toContain('live.com')
  })

  it('POSTs to provided submitUrl', () => {
    const html = renderEmailCredentialForm(schema, { submitUrl: '/authorize?nonce=xyz' })
    expect(html).toContain('/authorize?nonce=xyz')
  })

  it('uses safe DOM methods (createElement + textContent)', () => {
    const html = renderEmailCredentialForm(schema, { submitUrl: '/auth' })
    expect(html).toContain('createElement')
    expect(html).toContain('textContent')
  })

  it('formats EMAIL_CREDENTIALS as comma-separated email:password pairs', () => {
    const html = renderEmailCredentialForm(schema, { submitUrl: '/auth' })
    expect(html).toContain('EMAIL_CREDENTIALS')
  })

  it('shows original Outlook OAuth2 notice (auto-handled by server)', () => {
    const html = renderEmailCredentialForm(schema, { submitUrl: '/auth' })
    // No more "Phase L2" / "not supported" / "coming soon" language.
    expect(html).not.toMatch(/Phase L2/i)
    expect(html).not.toMatch(/not supported yet/i)
    expect(html).not.toMatch(/coming soon/i)
    // Keep the original notice.
    expect(html).toMatch(/Outlook[^"]*OAuth2?[^"]*handled automatically/i)
  })

  it('handles oauth_device_code response with verification URL + user code', () => {
    const html = renderEmailCredentialForm(schema, { submitUrl: '/auth' })
    expect(html).toContain('oauth_device_code')
    expect(html).toContain('verification_url')
    expect(html).toContain('user_code')
  })

  it('polls /setup-status for outlook === "complete"', () => {
    const html = renderEmailCredentialForm(schema, { submitUrl: '/authorize?nonce=abc' })
    expect(html).toContain('/setup-status')
    expect(html).toMatch(/s\.outlook\s*===\s*["']complete["']/)
  })

  it('no longer blocks submit when only Outlook accounts are present', () => {
    const html = renderEmailCredentialForm(schema, { submitUrl: '/auth' })
    // Previous behavior: showStatus("error", ... "Phase L2" ...). Gone now.
    expect(html).not.toMatch(/Outlook[^"]*not supported yet/i)
    expect(html).not.toMatch(/Remove any Outlook accounts/i)
  })
})
