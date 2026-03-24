import { describe, expect, it } from 'vitest'
import { textToHtml } from './smtp-client.js'

describe('textToHtml', () => {
  it('converts standard markdown to html', () => {
    const markdown = '# Header\n\n**bold** and *italic*\n\n- item 1\n- item 2'
    const html = textToHtml(markdown)
    expect(html).toContain('<h1>Header</h1>')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>italic</em>')
    expect(html).toContain('<ul>')
    expect(html).toContain('<li>item 1</li>')
  })

  it('strips dangerous attributes like onerror', () => {
    const html = textToHtml('<img src="x" onerror="alert(1)">')
    expect(html).toContain('<img src="x" />')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('alert')
  })

  it('strips javascript: links', () => {
    const html = textToHtml('[click me](javascript:alert(1))')
    expect(html).toContain('<a>click me</a>')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('alert')
  })

  it('strips script tags completely', () => {
    const html = textToHtml('<script>alert("XSS")</script>')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('alert')
    expect(html).not.toContain('XSS')
  })

  it('allows img tags', () => {
    const html = textToHtml('![alt text](https://example.com/image.jpg)')
    expect(html).toContain('<img src="https://example.com/image.jpg" alt="alt text" />')
  })

  it('converts newlines to <br> tags because breaks: true is used', () => {
    const html = textToHtml('line 1\nline 2')
    expect(html).toContain('line 1<br />line 2')
  })

  it('handles empty strings', () => {
    const html = textToHtml('')
    expect(html).toBe('')
  })

  it('strips data: and vbscript: URI schemes', () => {
    const html = textToHtml('![img](data:text/html,<script>alert(1)</script>)')
    expect(html).not.toContain('data:text/html')

    const vbHtml = textToHtml('[link](vbscript:alert(1))')
    expect(vbHtml).not.toContain('vbscript:')
  })

  it('supports markdown blockquotes', () => {
    const html = textToHtml('> Quoted text')
    expect(html).toContain('<blockquote>')
    expect(html).toContain('Quoted text')
  })

  it('handles malformed HTML gracefully', () => {
    const html = textToHtml('<img src=x onerror=alert(1)>')
    expect(html).toContain('<img src="x" />')
    expect(html).not.toContain('onerror')
  })

  it('allows h1 through h6 tags', () => {
    const markdown = '# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6'
    const html = textToHtml(markdown)
    expect(html).toContain('<h1>H1</h1>')
    expect(html).toContain('<h2>H2</h2>')
    expect(html).toContain('<h3>H3</h3>')
    expect(html).toContain('<h4>H4</h4>')
    expect(html).toContain('<h5>H5</h5>')
    expect(html).toContain('<h6>H6</h6>')
  })

  it('allows table tags if present in markdown', () => {
    const markdown = '| Col 1 | Col 2 |\n|---|---|\n| Val 1 | Val 2 |'
    const html = textToHtml(markdown)
    expect(html).toContain('<table>')
    expect(html).toContain('<th>Col 1</th>')
    expect(html).toContain('<td>Val 1</td>')
  })
})
