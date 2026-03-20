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

  it('converts tables to html', () => {
    const markdown = '| Header 1 | Header 2 |\n|---|---|\n| Cell 1 | Cell 2 |';
    const html = textToHtml(markdown);
    expect(html).toContain('<table>');
    expect(html).toContain('<thead>');
    expect(html).toContain('<th>Header 1</th>');
    expect(html).toContain('<th>Header 2</th>');
    expect(html).toContain('<tbody>');
    expect(html).toContain('<td>Cell 1</td>');
    expect(html).toContain('<td>Cell 2</td>');
  })

  it('converts blockquotes to html', () => {
    const html = textToHtml('> This is a quote');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('<p>This is a quote</p>');
    expect(html).toContain('</blockquote>');
  })

  it('converts code blocks and inline code to html', () => {
    const markdown = '`inline` and \n\n```\nblock\n```';
    const html = textToHtml(markdown);
    expect(html).toContain('<code>inline</code>');
    expect(html).toContain('<pre><code>block\n</code></pre>');
  })

  it('strips vbscript: and data: links', () => {
    const html = textToHtml('[click](vbscript:alert(1)) and [click2](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)');
    expect(html).not.toContain('vbscript:');
    expect(html).not.toContain('data:text/html');
    expect(html).toContain('<a>click</a>');
    expect(html).toContain('<a>click2</a>');
  })

  it('strips iframe tags completely', () => {
    const html = textToHtml('<iframe src="javascript:alert(1)"></iframe>');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('javascript:alert(1)');
  })

  it('strips style tags and css xss', () => {
    const html = textToHtml('<style>body { background: url("javascript:alert(1)") }</style>');
    expect(html).not.toContain('<style>');
    expect(html).not.toContain('background');
    expect(html).not.toContain('javascript:alert(1)');
  })

  it('handles complex nested malicious payloads', () => {
    const html = textToHtml('<a href="javascript:alert(1)"><img src="x" onmouseover="alert(2)"></a>');
    expect(html).toContain('<a><img src="x" /></a>');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('onmouseover');
    expect(html).not.toContain('alert');
  })
})
