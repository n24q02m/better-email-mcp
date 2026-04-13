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

  it('blocks submit if only Outlook accounts (deferred to L2)', () => {
    const html = renderEmailCredentialForm(schema, { submitUrl: '/auth' })
    expect(html).toMatch(/Outlook.*(not supported|Phase L2|coming soon)/i)
  })
})
