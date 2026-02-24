import { describe, expect, it, vi } from 'vitest'
import { loadConfig, parseCredentials, resolveAccount, resolveAccounts, AccountConfig } from './config.js'

describe('parseCredentials', () => {
  it('returns empty array for empty string', () => {
    expect(parseCredentials('')).toEqual([])
  })

  it('returns empty array for whitespace-only string', () => {
    expect(parseCredentials('   ')).toEqual([])
  })

  it('parses single Gmail account', () => {
    const result = parseCredentials('user@gmail.com:mypassword')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'user_gmail_com',
      email: 'user@gmail.com',
      password: 'mypassword',
      imap: { host: 'imap.gmail.com', port: 993, secure: true },
      smtp: { host: 'smtp.gmail.com', port: 465, secure: true }
    })
  })

  it('parses multiple accounts separated by comma', () => {
    const result = parseCredentials('user1@gmail.com:pass1,user2@outlook.com:pass2')
    expect(result).toHaveLength(2)
    expect(result[0]!.email).toBe('user1@gmail.com')
    expect(result[1]!.email).toBe('user2@outlook.com')
  })

  it('auto-discovers Outlook settings', () => {
    const result = parseCredentials('user@outlook.com:pass')
    expect(result[0]!.imap.host).toBe('outlook.office365.com')
    expect(result[0]!.smtp.host).toBe('smtp.office365.com')
    expect(result[0]!.smtp.port).toBe(587)
    expect(result[0]!.smtp.secure).toBe(false)
  })

  it('auto-discovers Hotmail as Outlook', () => {
    const result = parseCredentials('user@hotmail.com:pass')
    expect(result[0]!.imap.host).toBe('outlook.office365.com')
  })

  it('auto-discovers Live as Outlook', () => {
    const result = parseCredentials('user@live.com:pass')
    expect(result[0]!.imap.host).toBe('outlook.office365.com')
  })

  it('auto-discovers Yahoo settings', () => {
    const result = parseCredentials('user@yahoo.com:pass')
    expect(result[0]!.imap.host).toBe('imap.mail.yahoo.com')
    expect(result[0]!.smtp.host).toBe('smtp.mail.yahoo.com')
  })

  it('auto-discovers iCloud settings', () => {
    const result = parseCredentials('user@icloud.com:pass')
    expect(result[0]!.imap.host).toBe('imap.mail.me.com')
    expect(result[0]!.smtp.host).toBe('smtp.mail.me.com')
  })

  it('auto-discovers me.com as iCloud', () => {
    const result = parseCredentials('user@me.com:pass')
    expect(result[0]!.imap.host).toBe('imap.mail.me.com')
  })

  it('auto-discovers Zoho settings', () => {
    const result = parseCredentials('user@zoho.com:pass')
    expect(result[0]!.imap.host).toBe('imap.zoho.com')
  })

  it('auto-discovers ProtonMail settings', () => {
    const result = parseCredentials('user@protonmail.com:pass')
    expect(result[0]!.imap.host).toBe('imap.protonmail.ch')
  })

  it('auto-discovers googlemail.com as Gmail', () => {
    const result = parseCredentials('user@googlemail.com:pass')
    expect(result[0]!.imap.host).toBe('imap.gmail.com')
  })

  it('handles custom IMAP host (3-part format with hostname)', () => {
    const result = parseCredentials('user@custom.com:mypass:imap.custom.com')
    expect(result).toHaveLength(1)
    expect(result[0]!.imap.host).toBe('imap.custom.com')
    expect(result[0]!.smtp.host).toBe('smtp.custom.com')
    expect(result[0]!.password).toBe('mypass')
  })

  it('handles password with colon (3-part format without hostname)', () => {
    const result = parseCredentials('user@gmail.com:pass:word')
    expect(result).toHaveLength(1)
    expect(result[0]!.password).toBe('pass:word')
    expect(result[0]!.imap.host).toBe('imap.gmail.com')
  })

  it('handles password with multiple colons and custom host', () => {
    const result = parseCredentials('user@custom.com:pass:with:colons:imap.server.com')
    expect(result).toHaveLength(1)
    expect(result[0]!.password).toBe('pass:with:colons')
    expect(result[0]!.imap.host).toBe('imap.server.com')
  })

  it('handles password with multiple colons and no custom host', () => {
    const result = parseCredentials('user@gmail.com:pass:with:colons:nohostname')
    expect(result).toHaveLength(1)
    expect(result[0]!.password).toBe('pass:with:colons:nohostname')
  })

  it('skips invalid entries with only one part', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = parseCredentials('justanemail')
    expect(result).toHaveLength(0)
    spy.mockRestore()
  })

  it('skips unknown domains without custom host', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = parseCredentials('user@unknowndomain.xyz:password')
    expect(result).toHaveLength(0)
    spy.mockRestore()
  })

  it('trims whitespace around entries', () => {
    const result = parseCredentials('  user@gmail.com:pass  ,  user2@yahoo.com:pass2  ')
    expect(result).toHaveLength(2)
    expect(result[0]!.email).toBe('user@gmail.com')
    expect(result[1]!.email).toBe('user2@yahoo.com')
  })

  it('skips empty entries between commas', () => {
    const result = parseCredentials('user@gmail.com:pass,,user2@yahoo.com:pass2')
    expect(result).toHaveLength(2)
  })

  it('generates correct ID from email', () => {
    const result = parseCredentials('My.User@gmail.com:pass')
    expect(result[0]!.id).toBe('my_user_gmail_com')
  })
})

describe('loadConfig', () => {
  it('returns empty array when EMAIL_CREDENTIALS is not set', () => {
    const original = process.env.EMAIL_CREDENTIALS
    delete process.env.EMAIL_CREDENTIALS
    expect(loadConfig()).toEqual([])
    if (original) process.env.EMAIL_CREDENTIALS = original
  })

  it('parses EMAIL_CREDENTIALS from environment', () => {
    const original = process.env.EMAIL_CREDENTIALS
    process.env.EMAIL_CREDENTIALS = 'test@gmail.com:testpass'
    const result = loadConfig()
    expect(result).toHaveLength(1)
    expect(result[0]!.email).toBe('test@gmail.com')
    if (original) {
      process.env.EMAIL_CREDENTIALS = original
    } else {
      delete process.env.EMAIL_CREDENTIALS
    }
  })
})

const mockAccounts: AccountConfig[] = [
  {
    id: 'user1_gmail_com',
    email: 'user1@gmail.com',
    password: 'pass1',
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.gmail.com', port: 465, secure: true }
  },
  {
    id: 'user2_outlook_com',
    email: 'user2@outlook.com',
    password: 'pass2',
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
    smtp: { host: 'smtp.office365.com', port: 587, secure: false }
  },
  {
    id: 'other_user_gmail_com',
    email: 'other.user@gmail.com',
    password: 'pass3',
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.gmail.com', port: 465, secure: true }
  }
]

describe('resolveAccount', () => {
  it('resolves account by exact email match', () => {
    const result = resolveAccount(mockAccounts, 'user1@gmail.com')
    expect(result).toBe(mockAccounts[0])
  })

  it('resolves account by exact ID match', () => {
    const result = resolveAccount(mockAccounts, 'user2_outlook_com')
    expect(result).toBe(mockAccounts[1])
  })

  it('resolves account by partial email match', () => {
    const result = resolveAccount(mockAccounts, 'user2')
    expect(result).toBe(mockAccounts[1])
  })

  it('is case insensitive', () => {
    const result = resolveAccount(mockAccounts, 'USER1@GMAIL.COM')
    expect(result).toBe(mockAccounts[0])
  })

  it('throws error when account not found', () => {
    expect(() => resolveAccount(mockAccounts, 'nonexistent')).toThrow(/not found/)
  })

  it('throws error when multiple accounts match', () => {
    expect(() => resolveAccount(mockAccounts, 'gmail.com')).toThrow(/Multiple accounts matched/)
  })
})

describe('resolveAccounts', () => {
  it('returns all accounts when query is empty', () => {
    expect(resolveAccounts(mockAccounts)).toHaveLength(3)
    expect(resolveAccounts(mockAccounts, '')).toHaveLength(3)
  })

  it('returns specific account by exact email', () => {
    const result = resolveAccounts(mockAccounts, 'user1@gmail.com')
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(mockAccounts[0])
  })

  it('returns matching accounts by partial email', () => {
    const result = resolveAccounts(mockAccounts, 'gmail.com')
    expect(result).toHaveLength(2)
    expect(result.map(a => a.id)).toContain('user1_gmail_com')
    expect(result.map(a => a.id)).toContain('other_user_gmail_com')
  })

  it('is case insensitive', () => {
    const result = resolveAccounts(mockAccounts, 'USER1')
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(mockAccounts[0])
  })

  it('throws error when no accounts match', () => {
    expect(() => resolveAccounts(mockAccounts, 'nonexistent')).toThrow(/not found/)
  })

  it('returns match by ID', () => {
    const result = resolveAccounts(mockAccounts, 'user2_outlook_com')
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(mockAccounts[1])
  })
})
