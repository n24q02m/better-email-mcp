import { describe, expect, it } from 'vitest'
import { escapeHtml, fastExtractSnippet, htmlToCleanText, sanitizeHtml } from './html-utils.js'

describe('escapeHtml', () => {
  it('escapes &, <, >, ", and \'', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry')
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(escapeHtml('He said "Hello"')).toBe('He said &quot;Hello&quot;')
    expect(escapeHtml("It's a sunny day")).toBe('It&#039;s a sunny day')
  })

  it('escapes multiple occurrences of the same character', () => {
    expect(escapeHtml('<<<>>>')).toBe('&lt;&lt;&lt;&gt;&gt;&gt;')
    expect(escapeHtml('&&&')).toBe('&amp;&amp;&amp;')
  })

  it('returns an empty string if input is empty', () => {
    expect(escapeHtml('')).toBe('')
  })

  it('does not modify strings without special characters', () => {
    expect(escapeHtml('Just a normal string')).toBe('Just a normal string')
  })
})

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

describe('fastExtractSnippet', () => {
  it('returns empty for empty input', () => {
    expect(fastExtractSnippet('')).toBe('')
  })

  it('strips HTML tags', () => {
    expect(fastExtractSnippet('<p>Hello <b>world</b></p>')).toBe('Hello world')
  })

  it('removes style and script blocks', () => {
    const html = '<style>.x{color:red}</style><p>Content</p><script>alert(1)</script>'
    expect(fastExtractSnippet(html)).toBe('Content')
  })

  it('removes unclosed style and script blocks', () => {
    const html = '<style>.x{color:red}<p>Content</p><script>alert(1)'
    expect(fastExtractSnippet(html)).toBe('')

    const html2 = 'Hello <style>.x{color:red}'
    expect(fastExtractSnippet(html2)).toBe('Hello')

    const html3 = 'Hello <script>alert(1)'
    expect(fastExtractSnippet(html3)).toBe('Hello')
  })

  it('decodes HTML entities', () => {
    expect(fastExtractSnippet('&amp; &lt; &gt; &quot; &#039;')).toBe('& < > " \'')
  })

  it('truncates to maxLength', () => {
    const html = `<p>${'a'.repeat(300)}</p>`
    const result = fastExtractSnippet(html, 200)
    expect(result).toBe(`${'a'.repeat(200)}...`)
  })

  it('does not truncate short text', () => {
    expect(fastExtractSnippet('<p>short</p>', 200)).toBe('short')
  })

  it('collapses whitespace', () => {
    expect(fastExtractSnippet('<p>hello   \n\t  world</p>')).toBe('hello world')
  })

  it('fast path: plain text without HTML tags or entities (short)', () => {
    expect(fastExtractSnippet('Just plain text here')).toBe('Just plain text here')
  })

  it('fast path: plain text truncated when exceeding maxLength', () => {
    const long = 'x'.repeat(250)
    const result = fastExtractSnippet(long, 200)
    expect(result).toBe(`${'x'.repeat(200)}...`)
  })

  it('fast path: plain text not truncated when exactly maxLength', () => {
    const exact = 'y'.repeat(200)
    expect(fastExtractSnippet(exact, 200)).toBe(exact)
  })

  it('fast path: collapses whitespace in plain text', () => {
    expect(fastExtractSnippet('hello   \n\t   world')).toBe('hello world')
  })

  it('decodes numeric HTML entity (decimal)', () => {
    expect(fastExtractSnippet('&#65;&#66;&#67;')).toBe('ABC')
  })

  it('decodes numeric HTML entity (hex)', () => {
    expect(fastExtractSnippet('&#x41;&#x42;&#x43;')).toBe('ABC')
  })

  it('decodes uppercase hex entity', () => {
    expect(fastExtractSnippet('&#X41;')).toBe('A')
  })

  it('preserves unknown named entities', () => {
    expect(fastExtractSnippet('&unknownentity;')).toBe('&unknownentity;')
  })

  it('decodes &nbsp; entity', () => {
    expect(fastExtractSnippet('hello&nbsp;world')).toBe('hello world')
  })

  it('handles nested style and script blocks', () => {
    const html = '<style>.a{}</style><style>.b{}</style><p>Content</p><script>x()</script><script>y()</script>'
    expect(fastExtractSnippet(html)).toBe('Content')
  })

  it('handles block elements like div, p, br, tr, li, h1-h6', () => {
    const html = '<div>A</div><p>B</p><br/>C<tr>D</tr><li>E</li><h1>F</h1>'
    const result = fastExtractSnippet(html)
    expect(result).toContain('A')
    expect(result).toContain('B')
    expect(result).toContain('C')
  })
})

describe('sanitizeHtml', () => {
  it('sanitizes HTML with default options', () => {
    const dirty =
      '<p>Hello <script>alert("xss")</script> <img src="test.jpg"> <a href="javascript:alert(1)">Link</a></p>'
    const clean = sanitizeHtml(dirty)
    expect(clean).toContain('<p>Hello')
    expect(clean).toContain('<img src="test.jpg"')
    expect(clean).not.toContain('<script>')
    expect(clean).not.toContain('javascript:')
  })

  it('handles very large strings without crashing (1MB performance test)', () => {
    const largeString = `<p>${'a'.repeat(1024 * 1024)}</p>`
    const start = Date.now()
    const clean = sanitizeHtml(largeString)
    const duration = Date.now() - start

    expect(clean).toContain('aaaaaaaa')
    expect(duration).toBeLessThan(5000) // Ensure it finishes within 5 seconds
  })

  it('handles empty string', () => {
    expect(sanitizeHtml('')).toBe('')
  })

  it('handles null-like input', () => {
    expect(sanitizeHtml(null as any)).toBe('')
    expect(sanitizeHtml(undefined as any)).toBe('')
  })

  it('respects custom options', () => {
    const dirty = '<b>Bold</b> <i>Italic</i>'
    const clean = sanitizeHtml(dirty, { allowedTags: ['b'] })
    expect(clean).toContain('<b>Bold</b>')
    expect(clean).not.toContain('<i>')
    expect(clean).toContain('Italic')
  })

  it('handles complex nested structures in large strings', () => {
    // Generate 500 nested divs
    let complex = 'text'
    for (let i = 0; i < 500; i++) {
      complex = `<div>${complex}</div>`
    }
    const clean = sanitizeHtml(complex)
    expect(clean).toContain('text')
    expect((clean.match(/<div>/g) || []).length).toBe(500)
  })

  it('handles extremely long attribute values by stripping them or preserving if allowed', () => {
    const longAttr = 'a'.repeat(100000)
    // img.src is allowed by default
    const dirty = `<img src="${longAttr}">`
    const clean = sanitizeHtml(dirty)
    expect(typeof clean).toBe('string')
  })
})
