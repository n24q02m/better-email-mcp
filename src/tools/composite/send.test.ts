import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountConfig } from '../helpers/config.js'

// --- Mocks ---
vi.mock('../helpers/imap-client.js', () => ({
  readEmail: vi.fn()
}))

vi.mock('../helpers/smtp-client.js', () => ({
  sendNewEmail: vi.fn(),
  replyToEmail: vi.fn(),
  forwardEmail: vi.fn()
}))

import { readEmail } from '../helpers/imap-client.js'
import { forwardEmail, replyToEmail, sendNewEmail } from '../helpers/smtp-client.js'
import { send } from './send.js'

const mockReadEmail = vi.mocked(readEmail)
const mockSendNewEmail = vi.mocked(sendNewEmail)
const mockReplyToEmail = vi.mocked(replyToEmail)
const mockForwardEmail = vi.mocked(forwardEmail)

const accounts: AccountConfig[] = [
  {
    id: 'user1_gmail_com',
    email: 'user1@gmail.com',
    password: 'pass1',
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.gmail.com', port: 465, secure: true }
  }
]

beforeEach(() => {
  vi.clearAllMocks()
})

// ============================================================================
// new
// ============================================================================

describe('send - new', () => {
  it('sends a new email', async () => {
    mockSendNewEmail.mockResolvedValue({ success: true, message_id: '<new123@gmail.com>' })

    const result = await send(accounts, {
      action: 'new',
      account: 'user1@gmail.com',
      to: 'recipient@test.com',
      subject: 'Hello',
      body: 'World'
    })

    expect(result.action).toBe('new')
    expect(result.from).toBe('user1@gmail.com')
    expect(result.to).toBe('recipient@test.com')
    expect(result.success).toBe(true)
    expect(mockSendNewEmail).toHaveBeenCalledWith(
      accounts[0],
      expect.objectContaining({ to: 'recipient@test.com', subject: 'Hello', body: 'World' })
    )
  })

  it('throws when subject is missing for new email', async () => {
    await expect(
      send(accounts, {
        action: 'new',
        account: 'user1@gmail.com',
        to: 'r@test.com',
        subject: '',
        body: 'text'
      })
    ).rejects.toThrow('subject is required')
  })

  it('passes cc and bcc', async () => {
    mockSendNewEmail.mockResolvedValue({ success: true, message_id: '<id>' })

    await send(accounts, {
      action: 'new',
      account: 'user1@gmail.com',
      to: 'r@test.com',
      subject: 'T',
      body: 'B',
      cc: 'cc@test.com',
      bcc: 'bcc@test.com'
    })

    expect(mockSendNewEmail).toHaveBeenCalledWith(
      accounts[0],
      expect.objectContaining({ cc: 'cc@test.com', bcc: 'bcc@test.com' })
    )
  })
})

// ============================================================================
// reply
// ============================================================================

describe('send - reply', () => {
  it('replies to an email with thread headers', async () => {
    mockReadEmail.mockResolvedValue({
      account_id: 'user1_gmail_com',
      account_email: 'user1@gmail.com',
      uid: 42,
      message_id: '<original@test>',
      references: '<ref1@test>',
      subject: 'Original Subject',
      from: 'sender@test.com',
      to: 'user1@gmail.com',
      date: '2025-01-01',
      flags: [],
      body_text: 'original body',
      attachments: []
    })
    mockReplyToEmail.mockResolvedValue({ success: true, message_id: '<reply123@gmail.com>' })

    const result = await send(accounts, {
      action: 'reply',
      account: 'user1@gmail.com',
      to: 'sender@test.com',
      subject: '',
      body: 'My reply',
      uid: 42
    })

    expect(result.action).toBe('reply')
    expect(result.in_reply_to).toBe('<original@test>')
    expect(mockReplyToEmail).toHaveBeenCalledWith(
      accounts[0],
      expect.objectContaining({
        in_reply_to: '<original@test>',
        references: '<ref1@test>'
      })
    )
  })

  it('throws when uid is missing for reply', async () => {
    await expect(
      send(accounts, {
        action: 'reply',
        account: 'user1@gmail.com',
        to: 'x@test.com',
        subject: 'T',
        body: 'B'
        // no uid
      })
    ).rejects.toThrow('uid is required')
  })

  it('uses original subject when no subject provided', async () => {
    mockReadEmail.mockResolvedValue({
      account_id: 'user1_gmail_com',
      account_email: 'user1@gmail.com',
      uid: 1,
      message_id: '<msg@test>',
      subject: 'Original',
      from: 'x@test.com',
      to: 'y@test.com',
      date: '2025-01-01',
      flags: [],
      body_text: 'body',
      attachments: []
    })
    mockReplyToEmail.mockResolvedValue({ success: true, message_id: '<r@test>' })

    const result = await send(accounts, {
      action: 'reply',
      account: 'user1@gmail.com',
      to: 'x@test.com',
      subject: '',
      body: 'reply',
      uid: 1
    })

    expect(result.subject).toBe('Re: Original')
  })
})

// ============================================================================
// forward
// ============================================================================

describe('send - forward', () => {
  it('forwards email with original body', async () => {
    mockReadEmail.mockResolvedValue({
      account_id: 'user1_gmail_com',
      account_email: 'user1@gmail.com',
      uid: 50,
      subject: 'FW Subject',
      from: 'sender@test.com',
      to: 'user1@gmail.com',
      date: '2025-01-01',
      flags: [],
      body_text: 'original content',
      attachments: []
    })
    mockForwardEmail.mockResolvedValue({ success: true, message_id: '<fwd123@gmail.com>' })

    const result = await send(accounts, {
      action: 'forward',
      account: 'user1@gmail.com',
      to: 'third@test.com',
      subject: '',
      body: 'Check this',
      uid: 50
    })

    expect(result.action).toBe('forward')
    expect(mockForwardEmail).toHaveBeenCalledWith(
      accounts[0],
      expect.objectContaining({ original_body: 'original content' })
    )
  })

  it('throws when uid is missing for forward', async () => {
    await expect(
      send(accounts, {
        action: 'forward',
        account: 'user1@gmail.com',
        to: 'x@test.com',
        subject: 'T',
        body: 'B'
      })
    ).rejects.toThrow('uid is required')
  })
})

// ============================================================================
// validation
// ============================================================================

describe('send - validation', () => {
  it('throws when account is missing', async () => {
    await expect(
      send(accounts, {
        action: 'new',
        account: '',
        to: 'x@test.com',
        subject: 'T',
        body: 'B'
      })
    ).rejects.toThrow()
  })

  it('throws when to is missing', async () => {
    await expect(
      send(accounts, {
        action: 'new',
        account: 'user1@gmail.com',
        to: '',
        subject: 'T',
        body: 'B'
      })
    ).rejects.toThrow()
  })

  it('throws when body is missing', async () => {
    await expect(
      send(accounts, {
        action: 'new',
        account: 'user1@gmail.com',
        to: 'x@test.com',
        subject: 'T',
        body: ''
      })
    ).rejects.toThrow()
  })

  it('throws when account not found', async () => {
    await expect(
      send(accounts, {
        action: 'new',
        account: 'unknown@test.com',
        to: 'x@test.com',
        subject: 'T',
        body: 'B'
      })
    ).rejects.toThrow('Account not found')
  })

  it('throws for unknown action', async () => {
    await expect(
      send(accounts, {
        action: 'unknown' as any,
        account: 'user1@gmail.com',
        to: 'x@test.com',
        subject: 'T',
        body: 'B'
      })
    ).rejects.toThrow()
  })

  it('throws when multiple accounts match', async () => {
    const ambiguousAccounts: AccountConfig[] = [
      {
        id: 'user1_gmail_com',
        email: 'user1@gmail.com',
        password: 'p1',
        imap: { host: 'imap.gmail.com', port: 993, secure: true },
        smtp: { host: 'smtp.gmail.com', port: 465, secure: true }
      },
      {
        id: 'user2_gmail_com',
        email: 'user2@gmail.com',
        password: 'p2',
        imap: { host: 'imap.gmail.com', port: 993, secure: true },
        smtp: { host: 'smtp.gmail.com', port: 465, secure: true }
      }
    ]

    await expect(
      send(ambiguousAccounts, {
        action: 'new',
        account: 'gmail.com',
        to: 'r@test.com',
        subject: 'T',
        body: 'B'
      })
    ).rejects.toThrow('Multiple accounts matched')
  })
})
