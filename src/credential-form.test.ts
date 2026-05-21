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

  describe('security hardening', () => {
    it('includes a Content-Security-Policy meta tag', () => {
      const html = renderEmailCredentialForm(schema, { submitUrl: '/auth' })
      expect(html).toMatch(/<meta\s+http-equiv="Content-Security-Policy"/i)
      expect(html).toContain("default-src 'none'")
      expect(html).toContain("frame-ancestors 'none'")
      expect(html).toContain("base-uri 'none'")
    })

    it('serializes submitUrl as a JS literal (not HTML-escaped string)', () => {
      const html = renderEmailCredentialForm(schema, { submitUrl: '/authorize?nonce=abc' })
      // After the fix, submitUrl is interpolated via JSON.stringify, yielding
      // `var submitUrl = "/authorize?nonce=abc";` -- never `var submitUrl = "${...}"`.
      expect(html).toContain('var submitUrl = "/authorize?nonce=abc";')
    })

    it('escapes </script> in submitUrl so it cannot terminate the inline script', () => {
      const html = renderEmailCredentialForm(schema, {
        submitUrl: '/authorize?x=</script><script>alert(1)</script>'
      })
      // Look at the form's inline JS body (between its opening <script> tag
      // and its closing </script>). The raw `<script>`/`</script>` payload
      // must NOT appear inside the literal -- only the unicode-escaped form.
      const openIdx = html.indexOf('<script>')
      const scriptOpen = openIdx + '<script>'.length
      const scriptEnd = html.indexOf('</script>', scriptOpen)
      expect(scriptEnd).toBeGreaterThan(scriptOpen)
      const scriptBody = html.slice(scriptOpen, scriptEnd)
      expect(scriptBody).not.toContain('</script>')
      expect(scriptBody).not.toContain('<script>')
      expect(scriptBody).toContain('\\u003c/script\\u003e')
      expect(scriptBody).toContain('\\u003cscript\\u003e')
    })

    it('escapes quote injection in submitUrl (no script-string breakout)', () => {
      const html = renderEmailCredentialForm(schema, {
        submitUrl: '/x";alert("xss");//'
      })
      // The JSON.stringify-encoded literal must appear verbatim. Every quote
      // inside the value is escaped as \" so it cannot terminate the literal.
      expect(html).toContain('var submitUrl = "/x\\";alert(\\"xss\\");//";')

      // Defensive: every `alert(` (which only comes from the attacker payload)
      // must be reachable only INSIDE the JS string literal -- meaning each
      // `alert(` is preceded by `\";` (escaped-quote then semicolon, i.e.
      // literal content), never by a bare `";` (which would terminate the
      // literal and execute as JS).
      const openIdx = html.indexOf('<script>')
      const scriptOpen = openIdx + '<script>'.length
      const scriptEnd = html.indexOf('</script>', scriptOpen)
      const scriptBody = html.slice(scriptOpen, scriptEnd)
      const alertIdxs = [...scriptBody.matchAll(/alert\(/g)].map((m) => m.index!)
      expect(alertIdxs.length).toBeGreaterThan(0)
      for (const idx of alertIdxs) {
        // 3 characters preceding `alert(` should be `\";` -- the escaped
        // quote (still inside the literal) followed by a literal semicolon.
        expect(scriptBody.slice(idx - 3, idx)).toBe('\\";')
      }
    })

    it('wraps form controls in a disable-able fieldset', () => {
      const html = renderEmailCredentialForm(schema, { submitUrl: '/auth' })
      expect(html).toMatch(/<fieldset[^>]*id="form-fieldset"/i)
      expect(html).toContain('formFieldset.disabled')
    })

    it('clears submit button via DOM API rather than innerHTML when busy', () => {
      const html = renderEmailCredentialForm(schema, { submitUrl: '/auth' })
      // After the CSP-friendly fix, no innerHTML assignment of the spinner.
      expect(html).not.toMatch(/submitBtn\.innerHTML\s*=\s*'<span class="spinner"/)
      expect(html).toContain('createElement("span")')
    })
  })
})
