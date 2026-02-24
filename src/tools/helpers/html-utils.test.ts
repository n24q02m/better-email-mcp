import { describe, expect, it } from 'vitest'
import { htmlToCleanText, escapeHtml } from './html-utils.js'

describe('htmlToCleanText', () => {
  it('returns empty string for empty input', () => {
    expect(htmlToCleanText('')).toBe('')
  })

  it('returns empty string for null-like input', () => {
    expect(htmlToCleanText(null as any)).toBe('')
    expect(htmlToCleanText(undefined as any)).toBe('')
  })

  it('strips HTML tags', () => {
    const result = htmlToCleanText('<p>Hello <b>World</b></p>')
    expect(result).toContain('Hello')
    expect(result).toContain('World')
    expect(result).not.toContain('<p>')
    expect(result).not.toContain('<b>')
  })

  it('removes style tags', () => {
    const result = htmlToCleanText('<style>.red { color: red; }</style><p>Content</p>')
    expect(result).not.toContain('color')
    expect(result).toContain('Content')
  })

  it('removes script tags', () => {
    const result = htmlToCleanText('<script>alert("xss")</script><p>Safe</p>')
    expect(result).not.toContain('alert')
    expect(result).not.toContain('xss')
    expect(result).toContain('Safe')
  })

  it('removes img tags', () => {
    const result = htmlToCleanText('<p>Before</p><img src="test.png" alt="test"><p>After</p>')
    expect(result).not.toContain('test.png')
    expect(result).toContain('Before')
    expect(result).toContain('After')
  })

  it('preserves link text', () => {
    const result = htmlToCleanText('<a href="https://example.com">Click here</a>')
    expect(result).toContain('Click here')
  })

  it('handles links with href', () => {
    const result = htmlToCleanText('<a href="https://example.com">Visit</a>')
    expect(result).toContain('Visit')
    expect(result).toContain('https://example.com')
  })

  it('hides href when same as text', () => {
    const result = htmlToCleanText('<a href="https://example.com">https://example.com</a>')
    // Should not duplicate the URL
    const count = (result.match(/https:\/\/example\.com/g) || []).length
    expect(count).toBe(1)
  })

  it('handles nested HTML', () => {
    const html = '<div><h1>Title</h1><p>Paragraph with <strong>bold</strong> text.</p></div>'
    const result = htmlToCleanText(html)
    // html-to-text uppercases headings
    expect(result.toUpperCase()).toContain('TITLE')
    expect(result).toContain('bold')
    expect(result).toContain('text')
  })

  it('preserves newlines', () => {
    const result = htmlToCleanText('<p>Line 1</p><p>Line 2</p>')
    expect(result).toContain('Line 1')
    expect(result).toContain('Line 2')
  })

  it('handles tables', () => {
    const html = '<table><tr><th>Name</th><th>Value</th></tr><tr><td>A</td><td>1</td></tr></table>'
    const result = htmlToCleanText(html)
    // html-to-text uppercases table headers
    expect(result.toUpperCase()).toContain('NAME')
    expect(result.toUpperCase()).toContain('VALUE')
    expect(result).toContain('A')
    expect(result).toContain('1')
  })

  it('trims output', () => {
    const result = htmlToCleanText('  <p>  Content  </p>  ')
    expect(result).not.toMatch(/^\s/)
    expect(result).not.toMatch(/\s$/)
  })

  it('handles complex email HTML', () => {
    const html = `
      <html>
        <head><style>body { font-family: Arial; }</style></head>
        <body>
          <div style="max-width: 600px;">
            <h1>Newsletter</h1>
            <p>Hello <strong>User</strong>,</p>
            <p>Check out our <a href="https://example.com/deals">latest deals</a>.</p>
            <img src="banner.jpg" alt="Banner">
            <script>tracking()</script>
          </div>
        </body>
      </html>
    `
    const result = htmlToCleanText(html)
    // html-to-text uppercases headings
    expect(result.toUpperCase()).toContain('NEWSLETTER')
    expect(result).toContain('Hello')
    expect(result).toContain('User')
    expect(result).toContain('latest deals')
    expect(result).not.toContain('font-family')
    expect(result).not.toContain('tracking')
    expect(result).not.toContain('banner.jpg')
  })
})

describe('escapeHtml', () => {
  it('escapes special characters', () => {
    expect(escapeHtml('<script>alert("XSS")</script>')).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;')
    expect(escapeHtml('Hello & World')).toBe('Hello &amp; World')
    expect(escapeHtml("It's me")).toBe('It&#039;s me')
  })

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('')
  })
})
