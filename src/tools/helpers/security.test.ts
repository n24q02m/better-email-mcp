import { describe, expect, it } from 'vitest'
import { isSafeUrl, isValidToolName, wrapToolResult } from './security.js'

// ============================================================================
// isSafeUrl
// ============================================================================

describe('isSafeUrl', () => {
  it('allows http URLs', () => {
    expect(isSafeUrl('http://example.com')).toBe(true)
  })

  it('allows https URLs', () => {
    expect(isSafeUrl('https://example.com/path?q=1')).toBe(true)
  })

  it('allows mailto URLs', () => {
    expect(isSafeUrl('mailto:user@example.com')).toBe(true)
  })

  it('allows tel URLs', () => {
    expect(isSafeUrl('tel:+1234567890')).toBe(true)
  })

  it('blocks javascript: URLs', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false)
  })

  it('blocks data: URLs', () => {
    expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
  })

  it('blocks vbscript: URLs', () => {
    expect(isSafeUrl('vbscript:MsgBox("XSS")')).toBe(false)
  })

  it('blocks javascript: with control characters', () => {
    expect(isSafeUrl('java\x00script:alert(1)')).toBe(false)
  })

  it('blocks javascript: with whitespace bypass', () => {
    expect(isSafeUrl('java\tscript:alert(1)')).toBe(false)
  })

  it('blocks javascript: case-insensitive', () => {
    expect(isSafeUrl('JAVASCRIPT:alert(1)')).toBe(false)
  })

  it('blocks javascript& entity bypass', () => {
    expect(isSafeUrl('javascript&colon;alert(1)')).toBe(false)
  })

  it('returns false for invalid URLs that fail to parse', () => {
    expect(isSafeUrl('not-a-url')).toBe(false)
  })
})

// ============================================================================
// isValidToolName
// ============================================================================

describe('isValidToolName', () => {
  it('accepts valid tool names', () => {
    expect(isValidToolName('messages')).toBe(true)
    expect(isValidToolName('folders')).toBe(true)
    expect(isValidToolName('attachments')).toBe(true)
    expect(isValidToolName('send')).toBe(true)
    expect(isValidToolName('help')).toBe(true)
  })

  it('rejects invalid tool names', () => {
    expect(isValidToolName('invalid')).toBe(false)
    expect(isValidToolName('')).toBe(false)
    expect(isValidToolName('../etc/passwd')).toBe(false)
    expect(isValidToolName('messages/../secrets')).toBe(false)
  })
})

// ============================================================================
// wrapToolResult
// ============================================================================

describe('wrapToolResult', () => {
  it('wraps messages tool with safety markers', () => {
    const result = wrapToolResult('messages', '{"test": true}')
    expect(result).toContain('<untrusted_email_content>')
    expect(result).toContain('</untrusted_email_content>')
    expect(result).toContain('SECURITY')
    expect(result).toContain('UNTRUSTED')
  })

  it('wraps attachments tool with safety markers', () => {
    const result = wrapToolResult('attachments', '{"file": "test.pdf"}')
    expect(result).toContain('<untrusted_email_content>')
  })

  it('does not wrap safe tools', () => {
    expect(wrapToolResult('folders', '{"folders": []}')).toBe('{"folders": []}')
    expect(wrapToolResult('send', '{"success": true}')).toBe('{"success": true}')
    expect(wrapToolResult('help', '{"docs": ""}')).toBe('{"docs": ""}')
  })
})
