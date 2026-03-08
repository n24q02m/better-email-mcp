import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountConfig } from '../helpers/config.js'

// --- Mocks ---
vi.mock('../helpers/imap-client.js', () => ({
  readEmail: vi.fn(),
  resolveSentFolder: vi.fn(),
  appendToFolder: vi.fn()
}))

vi.mock('../helpers/smtp-client.js', () => ({
  sendNewEmail: vi.fn(),
  replyToEmail: vi.fn(),
  forwardEmail: vi.fn()
}))

import { appendToFolder, readEmail, resolveSentFolder } from '../helpers/imap-client.js'
import { forwardEmail, replyToEmail, sendNewEmail } from '../helpers/smtp-client.js'
import { send } from './send.js'

const mockReadEmail = vi.mocked(readEmail)
const mockSendNewEmail = vi.mocked(sendNewEmail)
const mockReplyToEmail = vi.mocked(replyToEmail)
const mockForwardEmail = vi.mocked(forwardEmail)
const mockResolveSentFolder = vi.mocked(resolveSentFolder)
const mockAppendToFolder = vi.mocked(appendToFolder)

const gmailAccounts: AccountConfig[] = [
  {
    id: 'user1_gmail_com',
    email: 'user1@gmail.com',
    password: 'pass1',
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.gmail.com', port: 465, secure: true }
  }
]

const outlookAccounts: AccountConfig[] = [
  {
    id: 'user1_outlook_com',
    email: 'user1@outlook.com',
    password: 'pass1',
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
    smtp: { host: 'smtp.office365.com', port: 587, secure: false }
  }
]

beforeEach(() => {
  vi.clearAllMocks()
  mockResolveSentFolder.mockResolvedValue('Sent')
  mockAppendToFolder.mockResolvedValue(true)
})

// ============================================================================
// new
// ============================================================================

describe('send - new', () => {
  it('sends a new email', async () => {
    mockSendNewEmail.mockResolvedValue({ success: true, message_id: '<new123@gmail.com>' })

    const result = await send(gmailAccounts, {
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
      gmailAccounts[0],
      expect.objectContaining({ to: 'recipient@test.com', subject: 'Hello', body: 'World' })
    )
  })

  it('throws when subject is missing for new email', async () => {
    await expect(
      send(gmailAccounts, {
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

    await send(gmailAccounts, {
      action: 'new',
      account: 'user1@gmail.com',
      to: 'r@test.com',
      subject: 'T',
      body: 'B',
      cc: 'cc@test.com',
      bcc: 'bcc@test.com'
    })

    expect(mockSendNewEmail).toHaveBeenCalledWith(
      gmailAccounts[0],
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

    const result = await send(gmailAccounts, {
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
      gmailAccounts[0],
      expect.objectContaining({
        in_reply_to: '<original@test>',
        references: '<ref1@test>'
      })
    )
  })

  it('throws when uid is missing for reply', async () => {
    await expect(
      send(gmailAccounts, {
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

    const result = await send(gmailAccounts, {
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

    const result = await send(gmailAccounts, {
      action: 'forward',
      account: 'user1@gmail.com',
      to: 'third@test.com',
      subject: '',
      body: 'Check this',
      uid: 50
    })

    expect(result.action).toBe('forward')
    expect(mockForwardEmail).toHaveBeenCalledWith(
      gmailAccounts[0],
      expect.objectContaining({ original_body: 'original content' })
    )
  })

  it('throws when uid is missing for forward', async () => {
    await expect(
      send(gmailAccounts, {
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
      send(gmailAccounts, {
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
      send(gmailAccounts, {
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
      send(gmailAccounts, {
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
      send(gmailAccounts, {
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
      send(gmailAccounts, {
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

// ============================================================================
// save-to-sent
// ============================================================================

describe('send - save to sent', () => {
  it('skips save-to-sent for Gmail (auto-saves)', async () => {
    mockSendNewEmail.mockResolvedValue({
      success: true,
      message_id: '<new@gmail.com>',
      raw: Buffer.from('raw-email')
    })

    const result = await send(gmailAccounts, {
      action: 'new',
      account: 'user1@gmail.com',
      to: 'r@test.com',
      subject: 'T',
      body: 'B'
    })

    expect(result.saved_to_sent).toBe(false)
    expect(mockAppendToFolder).not.toHaveBeenCalled()
  })

  it('saves to Sent folder for non-Gmail providers', async () => {
    mockSendNewEmail.mockResolvedValue({
      success: true,
      message_id: '<new@outlook.com>',
      raw: Buffer.from('raw-email')
    })
    mockResolveSentFolder.mockResolvedValue('Sent Items')

    const result = await send(outlookAccounts, {
      action: 'new',
      account: 'user1@outlook.com',
      to: 'r@test.com',
      subject: 'T',
      body: 'B'
    })

    expect(result.saved_to_sent).toBe(true)
    expect(mockResolveSentFolder).toHaveBeenCalledWith(outlookAccounts[0])
    expect(mockAppendToFolder).toHaveBeenCalledWith(outlookAccounts[0], 'Sent Items', expect.any(Buffer), ['\\Seen'])
  })

  it('returns saved_to_sent: false when raw is undefined', async () => {
    mockSendNewEmail.mockResolvedValue({
      success: true,
      message_id: '<new@outlook.com>'
      // no raw buffer
    })

    const result = await send(outlookAccounts, {
      action: 'new',
      account: 'user1@outlook.com',
      to: 'r@test.com',
      subject: 'T',
      body: 'B'
    })

    expect(result.saved_to_sent).toBe(false)
    expect(mockAppendToFolder).not.toHaveBeenCalled()
  })

  it('returns saved_to_sent: false when IMAP append fails (best-effort)', async () => {
    mockSendNewEmail.mockResolvedValue({
      success: true,
      message_id: '<new@outlook.com>',
      raw: Buffer.from('raw-email')
    })
    mockAppendToFolder.mockRejectedValue(new Error('IMAP connection failed'))

    const result = await send(outlookAccounts, {
      action: 'new',
      account: 'user1@outlook.com',
      to: 'r@test.com',
      subject: 'T',
      body: 'B'
    })

    // Send succeeded even though save-to-sent failed
    expect(result.success).toBe(true)
    expect(result.saved_to_sent).toBe(false)
  })

  it('saves to sent on reply for non-Gmail', async () => {
    mockReadEmail.mockResolvedValue({
      account_id: 'user1_outlook_com',
      account_email: 'user1@outlook.com',
      uid: 10,
      message_id: '<orig@test>',
      subject: 'Thread',
      from: 'sender@test.com',
      to: 'user1@outlook.com',
      date: '2025-01-01',
      flags: [],
      body_text: 'body',
      attachments: []
    })
    mockReplyToEmail.mockResolvedValue({
      success: true,
      message_id: '<reply@outlook.com>',
      raw: Buffer.from('raw-reply')
    })

    const result = await send(outlookAccounts, {
      action: 'reply',
      account: 'user1@outlook.com',
      body: 'reply',
      uid: 10
    })

    expect(result.saved_to_sent).toBe(true)
    expect(mockAppendToFolder).toHaveBeenCalled()
  })

  it('saves to sent on forward for non-Gmail', async () => {
    mockReadEmail.mockResolvedValue({
      account_id: 'user1_outlook_com',
      account_email: 'user1@outlook.com',
      uid: 20,
      subject: 'FW',
      from: 'sender@test.com',
      to: 'user1@outlook.com',
      date: '2025-01-01',
      flags: [],
      body_text: 'original',
      attachments: []
    })
    mockForwardEmail.mockResolvedValue({
      success: true,
      message_id: '<fwd@outlook.com>',
      raw: Buffer.from('raw-fwd')
    })

    const result = await send(outlookAccounts, {
      action: 'forward',
      account: 'user1@outlook.com',
      to: 'third@test.com',
      body: 'see attached',
      uid: 20
    })

    expect(result.saved_to_sent).toBe(true)
    expect(mockAppendToFolder).toHaveBeenCalled()
  })
})

// ============================================================================
// result fields
// ============================================================================

describe('send - new result fields', () => {
  it('returns result with all fields', async () => {
    mockSendNewEmail.mockResolvedValue({
      success: true,
      message_id: '<new-full@gmail.com>'
    })

    const result = await send(gmailAccounts, {
      action: 'new',
      account: 'user1@gmail.com',
      to: 'dest@test.com',
      subject: 'Full Result',
      body: 'Testing result'
    })

    expect(result).toEqual({
      action: 'new',
      from: 'user1@gmail.com',
      to: 'dest@test.com',
      subject: 'Full Result',
      success: true,
      message_id: '<new-full@gmail.com>',
      saved_to_sent: false
    })
  })
})

// ============================================================================
// reply auto-derive 'to' and references fallback
// ============================================================================

describe('send - reply auto-derive', () => {
  it('auto-derives to from original sender when to is not provided', async () => {
    mockReadEmail.mockResolvedValue({
      account_id: 'user1_gmail_com',
      account_email: 'user1@gmail.com',
      uid: 99,
      message_id: '<orig99@test>',
      references: '<ref99@test>',
      subject: 'Auto To',
      from: 'original@test.com',
      to: 'user1@gmail.com',
      date: '2025-06-01',
      flags: [],
      body_text: 'original body',
      attachments: []
    })
    mockReplyToEmail.mockResolvedValue({ success: true, message_id: '<reply99@gmail.com>' })

    const result = await send(gmailAccounts, {
      action: 'reply',
      account: 'user1@gmail.com',
      body: 'Auto-derived reply',
      uid: 99
    })

    expect(result.action).toBe('reply')
    expect(result.to).toBe('original@test.com')
    expect(mockReplyToEmail).toHaveBeenCalledWith(
      gmailAccounts[0],
      expect.objectContaining({
        to: 'original@test.com'
      })
    )
  })

  it('uses message_id as references fallback when references is absent', async () => {
    mockReadEmail.mockResolvedValue({
      account_id: 'user1_gmail_com',
      account_email: 'user1@gmail.com',
      uid: 77,
      message_id: '<msgid77@test>',
      subject: 'No References',
      from: 'sender77@test.com',
      to: 'user1@gmail.com',
      date: '2025-06-01',
      flags: [],
      body_text: 'body',
      attachments: []
    })
    mockReplyToEmail.mockResolvedValue({ success: true, message_id: '<reply77@gmail.com>' })

    await send(gmailAccounts, {
      action: 'reply',
      account: 'user1@gmail.com',
      to: 'sender77@test.com',
      body: 'Reply without references',
      uid: 77
    })

    expect(mockReplyToEmail).toHaveBeenCalledWith(
      gmailAccounts[0],
      expect.objectContaining({
        in_reply_to: '<msgid77@test>',
        references: '<msgid77@test>'
      })
    )
  })
})
