import { describe, expect, it } from 'vitest'
import { aiReadableMessage, EmailMCPError, enhanceError, suggestFixes, withErrorHandling } from './errors.js'

describe('EmailMCPError', () => {
  it('creates error with message and code', () => {
    const error = new EmailMCPError('test error', 'TEST_CODE')
    expect(error.message).toBe('test error')
    expect(error.code).toBe('TEST_CODE')
    expect(error.name).toBe('EmailMCPError')
    expect(error.suggestion).toBeUndefined()
    expect(error.details).toBeUndefined()
  })

  it('creates error with suggestion and details', () => {
    const error = new EmailMCPError('test', 'CODE', 'try this', { key: 'value' })
    expect(error.suggestion).toBe('try this')
    expect(error.details).toEqual({ key: 'value' })
  })

  it('serializes to JSON correctly', () => {
    const error = new EmailMCPError('msg', 'CODE', 'hint', { x: 1 })
    const json = error.toJSON()
    expect(json).toEqual({
      error: 'EmailMCPError',
      code: 'CODE',
      message: 'msg',
      suggestion: 'hint',
      details: { x: 1 }
    })
  })

  it('is an instance of Error', () => {
    const error = new EmailMCPError('test', 'CODE')
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(EmailMCPError)
  })
})

describe('enhanceError', () => {
  it('handles IMAP auth errors', () => {
    const result = enhanceError({ message: 'AUTHENTICATIONFAILED' })
    expect(result.code).toBe('AUTH_FAILED')
    expect(result.suggestion).toContain('App Password')
  })

  it('handles Invalid credentials', () => {
    const result = enhanceError({ message: 'Invalid credentials' })
    expect(result.code).toBe('AUTH_FAILED')
  })

  it('handles authenticationFailed flag', () => {
    const result = enhanceError({ message: 'some error', authenticationFailed: true })
    expect(result.code).toBe('AUTH_FAILED')
  })

  it('handles connection refused', () => {
    const result = enhanceError({ message: 'ECONNREFUSED' })
    expect(result.code).toBe('CONNECTION_ERROR')
  })

  it('handles DNS not found', () => {
    const result = enhanceError({ message: 'ENOTFOUND' })
    expect(result.code).toBe('CONNECTION_ERROR')
  })

  it('handles timeout', () => {
    const result = enhanceError({ message: 'ETIMEDOUT' })
    expect(result.code).toBe('CONNECTION_ERROR')
  })

  it('handles TLS errors', () => {
    const result = enhanceError({ message: 'SSL handshake failed' })
    expect(result.code).toBe('TLS_ERROR')
  })

  it('handles CERT errors', () => {
    const result = enhanceError({ message: 'CERT_HAS_EXPIRED' })
    expect(result.code).toBe('TLS_ERROR')
  })

  it('handles mailbox not found', () => {
    const result = enhanceError({ message: 'Mailbox not found' })
    expect(result.code).toBe('FOLDER_NOT_FOUND')
  })

  it('handles IMAP NONEXISTENT', () => {
    const result = enhanceError({ message: 'NO [NONEXISTENT] folder' })
    expect(result.code).toBe('FOLDER_NOT_FOUND')
  })

  it('handles SMTP 535 auth error', () => {
    const result = enhanceError({ message: 'auth failed', responseCode: 535 })
    expect(result.code).toBe('SMTP_AUTH_FAILED')
  })

  it('handles SMTP 550 recipient rejected', () => {
    const result = enhanceError({ message: 'rejected', responseCode: 550 })
    expect(result.code).toBe('RECIPIENT_REJECTED')
  })

  it('handles SMTP 552 message rejected', () => {
    const result = enhanceError({ message: 'too large', responseCode: 552 })
    expect(result.code).toBe('MESSAGE_REJECTED')
  })

  it('handles SMTP 554 message rejected', () => {
    const result = enhanceError({ message: 'spam', responseCode: 554 })
    expect(result.code).toBe('MESSAGE_REJECTED')
  })

  it('handles unknown SMTP error codes', () => {
    const result = enhanceError({ message: 'unknown', responseCode: 421 })
    expect(result.code).toBe('SMTP_421')
  })

  it('handles EMAIL_CREDENTIALS config error', () => {
    const result = enhanceError({ message: 'EMAIL_CREDENTIALS is missing' })
    expect(result.code).toBe('CONFIG_ERROR')
  })

  it('handles generic unknown errors', () => {
    const result = enhanceError({ message: 'something weird happened' })
    expect(result.code).toBe('UNKNOWN_ERROR')
  })

  it('handles errors with no message', () => {
    const result = enhanceError({})
    expect(result.code).toBe('UNKNOWN_ERROR')
    expect(result.message).toBe('Unknown error occurred')
  })

  it('sanitizes error details (no password leakage)', () => {
    const result = enhanceError({ message: 'generic', password: 'secret123', status: 500 })
    // details should not contain password
    if (result.details) {
      expect(result.details.password).toBeUndefined()
      expect(result.details.status).toBe(500)
    }
  })
})

describe('aiReadableMessage', () => {
  it('formats error without suggestion or details', () => {
    const error = new EmailMCPError('test error', 'CODE')
    const msg = aiReadableMessage(error)
    expect(msg).toBe('Error: test error')
  })

  it('includes suggestion when present', () => {
    const error = new EmailMCPError('test', 'CODE', 'try this')
    const msg = aiReadableMessage(error)
    expect(msg).toContain('Suggestion: try this')
  })

  it('includes details when present', () => {
    const error = new EmailMCPError('test', 'CODE', undefined, { key: 'val' })
    const msg = aiReadableMessage(error)
    expect(msg).toContain('Details:')
    expect(msg).toContain('"key": "val"')
  })

  it('includes both suggestion and details', () => {
    const error = new EmailMCPError('test', 'CODE', 'hint', { x: 1 })
    const msg = aiReadableMessage(error)
    expect(msg).toContain('Error: test')
    expect(msg).toContain('Suggestion: hint')
    expect(msg).toContain('Details:')
  })
})

describe('suggestFixes', () => {
  it('returns auth suggestions for AUTH_FAILED', () => {
    const error = new EmailMCPError('auth', 'AUTH_FAILED')
    const fixes = suggestFixes(error)
    expect(fixes.length).toBeGreaterThan(0)
    expect(fixes.some((f) => f.includes('App Password'))).toBe(true)
  })

  it('returns auth suggestions for SMTP_AUTH_FAILED', () => {
    const error = new EmailMCPError('smtp auth', 'SMTP_AUTH_FAILED')
    const fixes = suggestFixes(error)
    expect(fixes.some((f) => f.includes('App Password'))).toBe(true)
  })

  it('returns connection suggestions for CONNECTION_ERROR', () => {
    const error = new EmailMCPError('conn', 'CONNECTION_ERROR')
    const fixes = suggestFixes(error)
    expect(fixes.some((f) => f.includes('internet'))).toBe(true)
  })

  it('returns folder suggestions for FOLDER_NOT_FOUND', () => {
    const error = new EmailMCPError('folder', 'FOLDER_NOT_FOUND')
    const fixes = suggestFixes(error)
    expect(fixes.some((f) => f.includes('folders tool'))).toBe(true)
  })

  it('returns config suggestions for CONFIG_ERROR', () => {
    const error = new EmailMCPError('config', 'CONFIG_ERROR')
    const fixes = suggestFixes(error)
    expect(fixes.some((f) => f.includes('EMAIL_CREDENTIALS'))).toBe(true)
  })

  it('returns generic suggestions for unknown codes', () => {
    const error = new EmailMCPError('unknown', 'RANDOM_CODE')
    const fixes = suggestFixes(error)
    expect(fixes.length).toBeGreaterThan(0)
  })
})

describe('withErrorHandling', () => {
  it('passes through successful results', async () => {
    const fn = async () => 'success'
    const wrapped = withErrorHandling(fn)
    const result = await wrapped()
    expect(result).toBe('success')
  })

  it('enhances thrown errors', async () => {
    const fn = async () => {
      throw new Error('AUTHENTICATIONFAILED')
    }
    const wrapped = withErrorHandling(fn)
    await expect(wrapped()).rejects.toThrow(EmailMCPError)
    try {
      await wrapped()
    } catch (e) {
      expect((e as EmailMCPError).code).toBe('AUTH_FAILED')
    }
  })

  it('passes arguments through', async () => {
    const fn = async (a: number, b: number) => a + b
    const wrapped = withErrorHandling(fn)
    const result = await wrapped(2, 3)
    expect(result).toBe(5)
  })
})
