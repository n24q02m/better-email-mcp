import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountConfig } from './config.js'

// --- Mocks ---
const mockSendMail = vi.fn()
const mockClose = vi.fn()

vi.mock('nodemailer', () => ({
  createTransport: vi.fn().mockImplementation(() => ({
    sendMail: mockSendMail,
    close: mockClose
  }))
}))

import { createTransport } from 'nodemailer'
import { forwardEmail, replyToEmail, sendNewEmail } from './smtp-client.js'

const account: AccountConfig = {
  id: 'test_gmail_com',
  email: 'test@gmail.com',
  password: 'testpass',
  imap: { host: 'imap.gmail.com', port: 993, secure: true },
  smtp: { host: 'smtp.gmail.com', port: 465, secure: true }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSendMail.mockResolvedValue({ messageId: '<sent123@gmail.com>' })
})

// ============================================================================
// sendNewEmail
// ============================================================================

describe('sendNewEmail', () => {
  it('sends email with correct parameters', async () => {
    const result = await sendNewEmail(account, {
      to: 'recipient@test.com',
      subject: 'Hello',
      body: 'World',
      cc: 'cc@test.com',
      bcc: 'bcc@test.com'
    })

    expect(result.success).toBe(true)
    expect(result.message_id).toBe('<sent123@gmail.com>')
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'test@gmail.com',
        to: 'recipient@test.com',
        subject: 'Hello',
        text: 'World',
        cc: 'cc@test.com',
        bcc: 'bcc@test.com'
      })
    )
  })

  it('includes HTML version of the body', async () => {
    await sendNewEmail(account, {
      to: 'r@test.com',
      subject: 'Test',
      body: 'Simple line'
    })

    const callArgs = mockSendMail.mock.calls[0]![0]
    expect(callArgs.html).toContain('<p>Simple line</p>')
  })

  it('converts markdown headings to HTML', async () => {
    await sendNewEmail(account, {
      to: 'r@test.com',
      subject: 'Test',
      body: '# Title\n## Subtitle\n### Section'
    })

    const callArgs = mockSendMail.mock.calls[0]![0]
    expect(callArgs.html).toContain('<h1>Title</h1>')
    expect(callArgs.html).toContain('<h2>Subtitle</h2>')
    expect(callArgs.html).toContain('<h3>Section</h3>')
  })

  it('converts list items to HTML', async () => {
    await sendNewEmail(account, {
      to: 'r@test.com',
      subject: 'Test',
      body: '- Item 1\n- Item 2'
    })

    const callArgs = mockSendMail.mock.calls[0]![0]
    expect(callArgs.html).toContain('<li>Item 1</li>')
    expect(callArgs.html).toContain('<li>Item 2</li>')
  })

  it('converts bold text to HTML', async () => {
    await sendNewEmail(account, {
      to: 'r@test.com',
      subject: 'Test',
      body: '**Important**'
    })

    const callArgs = mockSendMail.mock.calls[0]![0]
    expect(callArgs.html).toContain('<b>Important</b>')
  })

  it('converts empty lines to br tags', async () => {
    await sendNewEmail(account, {
      to: 'r@test.com',
      subject: 'Test',
      body: 'Line 1\n\nLine 2'
    })

    const callArgs = mockSendMail.mock.calls[0]![0]
    expect(callArgs.html).toContain('<br>')
  })

  it('always closes transport', async () => {
    await sendNewEmail(account, { to: 'r@test.com', subject: 'T', body: 'B' })

    expect(mockClose).toHaveBeenCalled()
  })

  it('closes transport even on error', async () => {
    mockSendMail.mockRejectedValue(new Error('SMTP error'))

    await expect(sendNewEmail(account, { to: 'r@test.com', subject: 'T', body: 'B' })).rejects.toThrow()

    expect(mockClose).toHaveBeenCalled()
  })

  it('creates transport with correct SMTP config', async () => {
    await sendNewEmail(account, { to: 'r@test.com', subject: 'T', body: 'B' })

    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: 'test@gmail.com', pass: 'testpass' }
    })
  })

  it('handles empty messageId in response', async () => {
    mockSendMail.mockResolvedValue({})

    const result = await sendNewEmail(account, { to: 'r@test.com', subject: 'T', body: 'B' })

    expect(result.message_id).toBe('')
  })
})

// ============================================================================
// replyToEmail
// ============================================================================

describe('replyToEmail', () => {
  it('sends reply with In-Reply-To and References headers', async () => {
    const result = await replyToEmail(account, {
      to: 'original@test.com',
      subject: 'Original Subject',
      body: 'My reply',
      in_reply_to: '<original123@test>',
      references: '<ref1@test> <original123@test>'
    })

    expect(result.success).toBe(true)
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Re: Original Subject',
        inReplyTo: '<original123@test>',
        references: '<ref1@test> <original123@test>'
      })
    )
  })

  it('does not double-prepend Re: prefix', async () => {
    await replyToEmail(account, {
      to: 'x@test.com',
      subject: 'Re: Already has prefix',
      body: 'reply',
      in_reply_to: '<msg@test>'
    })

    const callArgs = mockSendMail.mock.calls[0]![0]
    expect(callArgs.subject).toBe('Re: Already has prefix')
  })

  it('uses in_reply_to as references fallback', async () => {
    await replyToEmail(account, {
      to: 'x@test.com',
      subject: 'Test',
      body: 'reply',
      in_reply_to: '<msg@test>'
      // no references provided
    })

    const callArgs = mockSendMail.mock.calls[0]![0]
    expect(callArgs.references).toBe('<msg@test>')
  })

  it('throws when in_reply_to is missing', async () => {
    await expect(
      replyToEmail(account, {
        to: 'x@test.com',
        subject: 'Test',
        body: 'reply'
        // no in_reply_to
      })
    ).rejects.toThrow('in_reply_to is required')
  })
})

// ============================================================================
// forwardEmail
// ============================================================================

describe('forwardEmail', () => {
  it('forwards email with original body appended', async () => {
    const result = await forwardEmail(account, {
      to: 'forward@test.com',
      subject: 'Original Subject',
      body: 'Check this out',
      original_body: 'This is the original email content'
    })

    expect(result.success).toBe(true)
    const callArgs = mockSendMail.mock.calls[0]![0]
    expect(callArgs.subject).toBe('Fwd: Original Subject')
    expect(callArgs.text).toContain('Check this out')
    expect(callArgs.text).toContain('---------- Forwarded message ----------')
    expect(callArgs.text).toContain('This is the original email content')
  })

  it('does not double-prepend Fwd: prefix', async () => {
    await forwardEmail(account, {
      to: 'x@test.com',
      subject: 'Fwd: Already forwarded',
      body: 'fwd',
      original_body: 'original'
    })

    const callArgs = mockSendMail.mock.calls[0]![0]
    expect(callArgs.subject).toBe('Fwd: Already forwarded')
  })

  it('includes cc and bcc when provided', async () => {
    await forwardEmail(account, {
      to: 'x@test.com',
      subject: 'Test',
      body: 'fwd',
      cc: 'cc@test.com',
      bcc: 'bcc@test.com',
      original_body: 'orig'
    })

    const callArgs = mockSendMail.mock.calls[0]![0]
    expect(callArgs.cc).toBe('cc@test.com')
    expect(callArgs.bcc).toBe('bcc@test.com')
  })
})
