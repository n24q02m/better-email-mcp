import { describe, expect, it, vi } from 'vitest'
import type { AccountConfig } from './config.js'
import { loadConfig, parseCredentials, resolveAccount, resolveAccounts, resolveSingleAccount } from './config.js'
import { EmailMCPError } from './errors.js'

describe('parseCredentials', () => {
  it('returns empty array for empty string', async () => {
    expect(await parseCredentials('')).toEqual([])
  })

  it('returns empty array for whitespace-only string', async () => {
    expect(await parseCredentials('   ')).toEqual([])
  })

  it('parses single Gmail account', async () => {
    const result = await parseCredentials('user@gmail.com:mypassword')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'user_gmail_com',
      email: 'user@gmail.com',
      password: 'mypassword',
      imap: { host: 'imap.gmail.com', port: 993, secure: true },
      smtp: { host: 'smtp.gmail.com', port: 465, secure: true }
    })
  })

  it('parses multiple accounts separated by comma', async () => {
    const result = await parseCredentials('user1@gmail.com:pass1,user2@outlook.com:pass2')
    expect(result).toHaveLength(2)
    expect(result[0]!.email).toBe('user1@gmail.com')
    expect(result[1]!.email).toBe('user2@outlook.com')
  })

  it('auto-discovers Outlook settings and sets OAuth2 auth type', async () => {
    const result = await parseCredentials('user@outlook.com:pass')
    expect(result[0]!.imap.host).toBe('outlook.office365.com')
    expect(result[0]!.smtp.host).toBe('smtp.office365.com')
    expect(result[0]!.smtp.port).toBe(587)
    expect(result[0]!.smtp.secure).toBe(false)
    // Outlook domains always use OAuth2, even without stored tokens
    expect(result[0]!.authType).toBe('oauth2')
    expect(result[0]!.oauth2).toBeUndefined()
  })

  it('auto-discovers Hotmail as Outlook', async () => {
    const result = await parseCredentials('user@hotmail.com:pass')
    expect(result[0]!.imap.host).toBe('outlook.office365.com')
  })

  it('auto-discovers Live as Outlook', async () => {
    const result = await parseCredentials('user@live.com:pass')
    expect(result[0]!.imap.host).toBe('outlook.office365.com')
  })

  it('auto-discovers Yahoo settings', async () => {
    const result = await parseCredentials('user@yahoo.com:pass')
    expect(result[0]!.imap.host).toBe('imap.mail.yahoo.com')
    expect(result[0]!.smtp.host).toBe('smtp.mail.yahoo.com')
  })

  it('auto-discovers iCloud settings', async () => {
    const result = await parseCredentials('user@icloud.com:pass')
    expect(result[0]!.imap.host).toBe('imap.mail.me.com')
    expect(result[0]!.smtp.host).toBe('smtp.mail.me.com')
  })

  it('auto-discovers me.com as iCloud', async () => {
    const result = await parseCredentials('user@me.com:pass')
    expect(result[0]!.imap.host).toBe('imap.mail.me.com')
  })

  it('auto-discovers Zoho settings', async () => {
    const result = await parseCredentials('user@zoho.com:pass')
    expect(result[0]!.imap.host).toBe('imap.zoho.com')
  })

  it('auto-discovers ProtonMail settings', async () => {
    const result = await parseCredentials('user@protonmail.com:pass')
    expect(result[0]!.imap.host).toBe('imap.protonmail.ch')
  })

  it('auto-discovers googlemail.com as Gmail', async () => {
    const result = await parseCredentials('user@googlemail.com:pass')
    expect(result[0]!.imap.host).toBe('imap.gmail.com')
  })

  it('handles custom IMAP host (3-part format with hostname)', async () => {
    const result = await parseCredentials('user@custom.com:mypass:imap.custom.com')
    expect(result).toHaveLength(1)
    expect(result[0]!.imap.host).toBe('imap.custom.com')
    expect(result[0]!.smtp.host).toBe('smtp.custom.com')
    expect(result[0]!.password).toBe('mypass')
  })

  it('handles password with colon (3-part format without hostname)', async () => {
    const result = await parseCredentials('user@gmail.com:pass:word')
    expect(result).toHaveLength(1)
    expect(result[0]!.password).toBe('pass:word')
    expect(result[0]!.imap.host).toBe('imap.gmail.com')
  })

  it('handles password with multiple colons and custom host', async () => {
    const result = await parseCredentials('user@custom.com:pass:with:colons:imap.server.com')
    expect(result).toHaveLength(1)
    expect(result[0]!.password).toBe('pass:with:colons')
    expect(result[0]!.imap.host).toBe('imap.server.com')
  })

  it('handles password with multiple colons and no custom host', async () => {
    const result = await parseCredentials('user@gmail.com:pass:with:colons:nohostname')
    expect(result).toHaveLength(1)
    expect(result[0]!.password).toBe('pass:with:colons:nohostname')
  })

  it('skips invalid entries with only one part', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await parseCredentials('justanemail')
    expect(result).toHaveLength(0)
    spy.mockRestore()
  })

  it('skips unknown domains without custom host', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await parseCredentials('user@unknowndomain.xyz:password')
    expect(result).toHaveLength(0)
    spy.mockRestore()
  })

  it('trims whitespace around entries', async () => {
    const result = await parseCredentials('  user@gmail.com:pass  ,  user2@yahoo.com:pass2  ')
    expect(result).toHaveLength(2)
    expect(result[0]!.email).toBe('user@gmail.com')
    expect(result[1]!.email).toBe('user2@yahoo.com')
  })

  it('skips empty entries between commas', async () => {
    const result = await parseCredentials('user@gmail.com:pass,,user2@yahoo.com:pass2')
    expect(result).toHaveLength(2)
  })

  it('generates correct ID from email', async () => {
    const result = await parseCredentials('My.User@gmail.com:pass')
    expect(result[0]!.id).toBe('my_user_gmail_com')
  })
})

describe('loadConfig', () => {
  it('returns empty array when EMAIL_CREDENTIALS is not set', async () => {
    const original = process.env.EMAIL_CREDENTIALS
    delete process.env.EMAIL_CREDENTIALS
    expect(await loadConfig()).toEqual([])
    if (original) process.env.EMAIL_CREDENTIALS = original
  })

  it('parses EMAIL_CREDENTIALS from environment', async () => {
    const original = process.env.EMAIL_CREDENTIALS
    process.env.EMAIL_CREDENTIALS = 'test@gmail.com:testpass'
    const result = await loadConfig()
    expect(result).toHaveLength(1)
    expect(result[0]!.email).toBe('test@gmail.com')
    if (original) {
      process.env.EMAIL_CREDENTIALS = original
    } else {
      delete process.env.EMAIL_CREDENTIALS
    }
  })
})

it('vulnerability reproduction: exposes sensitive data in logs', async () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
  const sensitivePart = 'SecretPassword'
  // malformed entry: short email concatenated with password, no colon
  const input = `me@x.com${sensitivePart}`
  // "me@x.comSecretPassword"
  // substring(0, 20) -> "me@x.comSecretPasswo"

  parseCredentials(input)

  // The vulnerability is that it logs the substring which contains the password
  expect(spy).not.toHaveBeenCalledWith(expect.stringContaining('SecretPasswo'))
  spy.mockRestore()
})

const testAccounts: AccountConfig[] = [
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
  }
]

describe('resolveAccount', () => {
  it('resolves by exact email match', async () => {
    const result = resolveAccount(testAccounts, 'user1@gmail.com')
    expect(result.email).toBe('user1@gmail.com')
  })

  it('resolves by exact id match', async () => {
    const result = resolveAccount(testAccounts, 'user2_outlook_com')
    expect(result.email).toBe('user2@outlook.com')
  })

  it('resolves by partial email match', async () => {
    const result = resolveAccount(testAccounts, 'outlook')
    expect(result.email).toBe('user2@outlook.com')
  })

  it('is case-insensitive', async () => {
    const result = resolveAccount(testAccounts, 'User1@Gmail.com')
    expect(result.email).toBe('user1@gmail.com')
  })

  it('throws ACCOUNT_NOT_FOUND when no match', async () => {
    expect(() => resolveAccount(testAccounts, 'nonexistent@test.com')).toThrow(EmailMCPError)
    try {
      resolveAccount(testAccounts, 'nonexistent@test.com')
    } catch (e) {
      expect(e).toBeInstanceOf(EmailMCPError)
      expect((e as EmailMCPError).code).toBe('ACCOUNT_NOT_FOUND')
    }
  })

  it('throws AMBIGUOUS_ACCOUNT when multiple partial matches', async () => {
    expect(() => resolveAccount(testAccounts, 'user')).toThrow(EmailMCPError)
    try {
      resolveAccount(testAccounts, 'user')
    } catch (e) {
      expect(e).toBeInstanceOf(EmailMCPError)
      expect((e as EmailMCPError).code).toBe('AMBIGUOUS_ACCOUNT')
    }
  })
})

describe('resolveSingleAccount', () => {
  it('resolves with a specific filter', async () => {
    const result = resolveSingleAccount(testAccounts, 'user1@gmail.com')
    expect(result.email).toBe('user1@gmail.com')
  })

  it('returns the only account when no filter and single account', async () => {
    const single = [testAccounts[0]!]
    const result = resolveSingleAccount(single)
    expect(result.email).toBe('user1@gmail.com')
  })

  it('throws AMBIGUOUS_ACCOUNT when no filter and multiple accounts', async () => {
    expect(() => resolveSingleAccount(testAccounts)).toThrow(EmailMCPError)
    try {
      resolveSingleAccount(testAccounts)
    } catch (e) {
      expect(e).toBeInstanceOf(EmailMCPError)
      expect((e as EmailMCPError).code).toBe('AMBIGUOUS_ACCOUNT')
    }
  })

  it('throws AMBIGUOUS_ACCOUNT when filter matches multiple accounts', async () => {
    expect(() => resolveSingleAccount(testAccounts, 'user')).toThrow(EmailMCPError)
    try {
      resolveSingleAccount(testAccounts, 'user')
    } catch (e) {
      expect(e).toBeInstanceOf(EmailMCPError)
      expect((e as EmailMCPError).code).toBe('AMBIGUOUS_ACCOUNT')
    }
  })
})

describe('resolveAccounts', () => {
  it('throws NO_ACCOUNTS when accounts array is empty', async () => {
    expect(() => resolveAccounts([])).toThrow(EmailMCPError)
    try {
      resolveAccounts([])
    } catch (e) {
      expect(e).toBeInstanceOf(EmailMCPError)
      expect((e as EmailMCPError).code).toBe('NO_ACCOUNTS')
    }
  })

  it('throws NO_ACCOUNTS when accounts empty with query', async () => {
    expect(() => resolveAccounts([], 'user@test.com')).toThrow(EmailMCPError)
    try {
      resolveAccounts([], 'user@test.com')
    } catch (e) {
      expect(e).toBeInstanceOf(EmailMCPError)
      expect((e as EmailMCPError).code).toBe('NO_ACCOUNTS')
    }
  })

  it('returns all accounts when no query', async () => {
    const result = resolveAccounts(testAccounts)
    expect(result).toHaveLength(2)
    expect(result).toEqual(testAccounts)
  })

  it('returns all accounts when query is undefined', async () => {
    const result = resolveAccounts(testAccounts, undefined)
    expect(result).toHaveLength(2)
  })

  it('returns exact match by email', async () => {
    const result = resolveAccounts(testAccounts, 'user1@gmail.com')
    expect(result).toHaveLength(1)
    expect(result[0]!.email).toBe('user1@gmail.com')
  })

  it('returns exact match by id', async () => {
    const result = resolveAccounts(testAccounts, 'user2_outlook_com')
    expect(result).toHaveLength(1)
    expect(result[0]!.email).toBe('user2@outlook.com')
  })

  it('returns partial matches', async () => {
    const result = resolveAccounts(testAccounts, 'user')
    expect(result).toHaveLength(2)
  })

  it('returns single partial match', async () => {
    const result = resolveAccounts(testAccounts, 'gmail')
    expect(result).toHaveLength(1)
    expect(result[0]!.email).toBe('user1@gmail.com')
  })

  it('throws ACCOUNT_NOT_FOUND when no match', async () => {
    expect(() => resolveAccounts(testAccounts, 'nonexistent@test.com')).toThrow(EmailMCPError)
    try {
      resolveAccounts(testAccounts, 'nonexistent@test.com')
    } catch (e) {
      expect(e).toBeInstanceOf(EmailMCPError)
      expect((e as EmailMCPError).code).toBe('ACCOUNT_NOT_FOUND')
    }
  })
})
