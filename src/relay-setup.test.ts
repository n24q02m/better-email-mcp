import { describe, expect, it } from 'vitest'
import { assembleEmailCredentials, formatCredentials } from './relay-setup.js'

describe('formatCredentials', () => {
  it('formats a single email:password pair (legacy format)', () => {
    const result = formatCredentials({ email: 'user@gmail.com', password: 'secret123' })
    expect(result).toBe('user@gmail.com:secret123')
  })

  it('includes custom IMAP host when provided (legacy format)', () => {
    const result = formatCredentials({
      email: 'user@custom.com',
      password: 'secret123',
      imap_host: 'imap.custom.com'
    })
    expect(result).toBe('user@custom.com:secret123:imap.custom.com')
  })

  it('throws when email is missing', () => {
    expect(() => formatCredentials({ password: 'pass' })).toThrow('missing required fields')
  })

  it('throws when password is missing', () => {
    expect(() => formatCredentials({ email: 'user@gmail.com' })).toThrow('missing required fields')
  })

  it('preserves colons in the password portion of the legacy format', () => {
    const result = formatCredentials({ email: 'user@gmail.com', password: 'pass:with:colons' })
    expect(result).toBe('user@gmail.com:pass:with:colons')
  })

  it('passes through the new multi-account EMAIL_CREDENTIALS form', () => {
    const result = formatCredentials({ EMAIL_CREDENTIALS: 'a@b.com:pass1,c@d.com:pass2' })
    expect(result).toBe('a@b.com:pass1,c@d.com:pass2')
  })
})

describe('assembleEmailCredentials', () => {
  it('encodes a single email:password pair', () => {
    expect(assembleEmailCredentials([{ email: 'user@gmail.com', password: 'secret123' }])).toBe(
      'user@gmail.com:secret123'
    )
  })

  it('appends a custom IMAP host', () => {
    expect(assembleEmailCredentials([{ email: 'user@custom.com', password: 'p', imap_host: 'imap.custom.com' }])).toBe(
      'user@custom.com:p:imap.custom.com'
    )
  })

  it('appends host and port when both are supplied', () => {
    expect(
      assembleEmailCredentials([
        { email: 'user@custom.com', password: 'p', imap_host: 'imap.custom.com', imap_port: '1993' }
      ])
    ).toBe('user@custom.com:p:imap.custom.com:1993')
  })

  it('does not double-append a port when the host already carries one', () => {
    expect(
      assembleEmailCredentials([
        { email: 'user@custom.com', password: 'p', imap_host: 'localhost:1993', imap_port: '2993' }
      ])
    ).toBe('user@custom.com:p:localhost:1993')
  })

  it('drops an IMAP port with no host (parity with the fork encoder)', () => {
    expect(assembleEmailCredentials([{ email: 'user@custom.com', password: 'p', imap_port: '1993' }])).toBe(
      'user@custom.com:p'
    )
  })

  it('emits email-only for Outlook/Hotmail/Live and ignores any typed password', () => {
    expect(assembleEmailCredentials([{ email: 'user@outlook.com', password: 'ignored' }])).toBe('user@outlook.com')
    expect(assembleEmailCredentials([{ email: 'user@hotmail.com' }])).toBe('user@hotmail.com')
    expect(assembleEmailCredentials([{ email: 'user@live.com', password: '' }])).toBe('user@live.com')
  })

  it('joins multiple accounts with commas (mixed providers)', () => {
    const result = assembleEmailCredentials([
      { email: 'a@gmail.com', password: 'p1' },
      { email: 'b@outlook.com', password: '' },
      { email: 'c@custom.com', password: 'p3', imap_host: 'imap.custom.com', imap_port: '1993' }
    ])
    expect(result).toBe('a@gmail.com:p1,b@outlook.com,c@custom.com:p3:imap.custom.com:1993')
  })

  it('skips cards without an email', () => {
    expect(assembleEmailCredentials([{ password: 'p' }, { email: 'a@gmail.com', password: 'p1' }])).toBe(
      'a@gmail.com:p1'
    )
  })

  it('skips non-Outlook cards without a password', () => {
    expect(assembleEmailCredentials([{ email: 'a@gmail.com' }, { email: 'b@gmail.com', password: 'p2' }])).toBe(
      'b@gmail.com:p2'
    )
  })

  it('trims surrounding whitespace on email and IMAP host', () => {
    expect(
      assembleEmailCredentials([{ email: '  user@custom.com  ', password: 'p', imap_host: '  imap.custom.com  ' }])
    ).toBe('user@custom.com:p:imap.custom.com')
  })

  it('returns an empty string for an empty or missing array', () => {
    expect(assembleEmailCredentials([])).toBe('')
    expect(assembleEmailCredentials(undefined)).toBe('')
  })
})
