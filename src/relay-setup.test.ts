import { describe, expect, it } from 'vitest'
import { formatCredentials } from './relay-setup.js'

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
