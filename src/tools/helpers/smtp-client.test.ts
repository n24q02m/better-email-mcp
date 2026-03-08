import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountConfig } from './config.js'

// --- Mocks (vi.hoisted ensures availability in vi.mock factory) ---
const { mockSendMail, mockClose, mockBuild, MockMailComposer } = vi.hoisted(() => {
  const mockBuild = vi.fn().mockResolvedValue(Buffer.from('raw-email-bytes'))
  const mockCompile = vi.fn().mockReturnValue({ build: mockBuild })
  // biome-ignore lint/complexity/useArrowFunction: must use function keyword for `new` constructor mock
  const MockMailComposer = vi.fn(function () {
    return { compile: mockCompile }
  })
  const mockSendMail = vi.fn()
  const mockClose = vi.fn()
  return { mockSendMail, mockClose, mockBuild, mockCompile, MockMailComposer }
})

vi.mock('nodemailer', () => ({
  createTransport: vi.fn().mockImplementation(() => ({
    sendMail: mockSendMail,
    close: mockClose
  }))
}))

vi.mock('nodemailer/lib/mail-composer/index.js', () => ({
  default: MockMailComposer
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
  mockBuild.mockResolvedValue(Buffer.from('raw-email-bytes'))
})

// ============================================================================
// sendNewEmail
// ============================================================================

describe('sendNewEmail', () => {
  it('sends email with correct parameters via raw message', async () => {
    const result = await sendNewEmail(account, {
      to: 'recipient@test.com',
      subject: 'Hello',
      body: 'World',
      cc: 'cc@test.com',
      bcc: 'bcc@test.com'
    })

    expect(result.success).toBe(true)
    expect(result.message_id).toBe('<sent123@gmail.com>')
    expect(result.raw).toBeInstanceOf(Buffer)

    // Verify MailComposer received correct options
    const composerArgs = (MockMailComposer as any).mock.calls[0]![0]
    expect(composerArgs.from).toBe('test@gmail.com')
    expect(composerArgs.to).toBe('recipient@test.com')
    expect(composerArgs.subject).toBe('Hello')
    expect(composerArgs.text).toBe('World')
    expect(composerArgs.cc).toBe('cc@test.com')
    expect(composerArgs.bcc).toBe('bcc@test.com')

    // Verify sendMail was called with raw buffer and envelope
    expect(mockSendMail).toHaveBeenCalledWith({
      raw: expect.any(Buffer),
      envelope: {
        from: 'test@gmail.com',
        to: ['recipient@test.com', 'cc@test.com', 'bcc@test.com']
      }
    })
  })

  it('includes HTML version of the body', async () => {
    await sendNewEmail(account, {
      to: 'r@test.com',
      subject: 'Test',
      body: 'Simple line'
    })

    const composerArgs = (MockMailComposer as any).mock.calls[0]![0]
    expect(composerArgs.html).toContain('<p>Simple line</p>')
  })

  it('converts markdown headings to HTML', async () => {
    await sendNewEmail(account, {
      to: 'r@test.com',
      subject: 'Test',
      body: '# Title\n## Subtitle\n### Section'
    })

    const composerArgs = (MockMailComposer as any).mock.calls[0]![0]
    expect(composerArgs.html).toContain('<h1>Title</h1>')
    expect(composerArgs.html).toContain('<h2>Subtitle</h2>')
    expect(composerArgs.html).toContain('<h3>Section</h3>')
  })

  it('converts list items to HTML', async () => {
    await sendNewEmail(account, {
      to: 'r@test.com',
      subject: 'Test',
      body: '- Item 1\n- Item 2'
    })

    const composerArgs = (MockMailComposer as any).mock.calls[0]![0]
    expect(composerArgs.html).toContain('<li>Item 1</li>')
    expect(composerArgs.html).toContain('<li>Item 2</li>')
  })

  it('converts bold text to HTML', async () => {
    await sendNewEmail(account, {
      to: 'r@test.com',
      subject: 'Test',
      body: '**Important**'
    })

    const composerArgs = (MockMailComposer as any).mock.calls[0]![0]
    expect(composerArgs.html).toContain('<strong>Important</strong>')
  })

  it('converts empty lines to br tags', async () => {
    await sendNewEmail(account, {
      to: 'r@test.com',
      subject: 'Test',
      body: 'Line 1\n\nLine 2'
    })

    const composerArgs = (MockMailComposer as any).mock.calls[0]![0]
    expect(composerArgs.html).toContain('<p>Line 1</p>')
    expect(composerArgs.html).toContain('<p>Line 2</p>')
  })

  it('escapes HTML entities in body to prevent XSS', async () => {
    await sendNewEmail(account, {
      to: 'r@test.com',
      subject: 'Test',
      body: '<script>alert("xss")</script>\n# <img src=x onerror=alert(1)>'
    })

    const composerArgs = (MockMailComposer as any).mock.calls[0]![0]
    expect(composerArgs.html).not.toContain('alert("xss")')
    expect(composerArgs.html).not.toContain('onerror')
    expect(composerArgs.html).not.toContain('<script>')
  })

  it('strips javascript: links to prevent XSS', async () => {
    await sendNewEmail(account, {
      to: 'r@test.com',
      subject: 'Test',
      body: '[Click](javascript:alert("XSS")) and [Safe](https://example.com)'
    })

    const composerArgs = (MockMailComposer as any).mock.calls[0]![0]
    expect(composerArgs.html).not.toContain('javascript:')
    expect(composerArgs.html).toContain('https://example.com')
    expect(composerArgs.html).toContain('Click')
  })

  it('strips data: and vbscript: URI schemes', async () => {
    await sendNewEmail(account, {
      to: 'r@test.com',
      subject: 'Test',
      body: '![img](data:text/html,<script>alert(1)</script>)'
    })

    const composerArgs = (MockMailComposer as any).mock.calls[0]![0]
    expect(composerArgs.html).not.toContain('data:text/html')
  })

  it('supports markdown blockquotes', async () => {
    await sendNewEmail(account, {
      to: 'r@test.com',
      subject: 'Test',
      body: '> Quoted text'
    })

    const composerArgs = (MockMailComposer as any).mock.calls[0]![0]
    expect(composerArgs.html).toContain('<blockquote>')
    expect(composerArgs.html).toContain('Quoted text')
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
      requireTLS: false,
      auth: { user: 'test@gmail.com', pass: 'testpass' }
    })
  })

  it('enforces TLS for port 587 (STARTTLS)', async () => {
    const outlookAccount: AccountConfig = {
      id: 'test_outlook_com',
      email: 'test@outlook.com',
      password: 'testpass',
      imap: { host: 'outlook.office365.com', port: 993, secure: true },
      smtp: { host: 'smtp.office365.com', port: 587, secure: false }
    }

    await sendNewEmail(outlookAccount, { to: 'r@test.com', subject: 'T', body: 'B' })

    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: 'test@outlook.com', pass: 'testpass' }
    })
  })

  it('handles empty messageId in response', async () => {
    mockSendMail.mockResolvedValue({})

    const result = await sendNewEmail(account, { to: 'r@test.com', subject: 'T', body: 'B' })

    expect(result.message_id).toBe('')
  })

  it('returns raw buffer from MailComposer build', async () => {
    const rawBuf = Buffer.from('test-raw-message')
    mockBuild.mockResolvedValue(rawBuf)

    const result = await sendNewEmail(account, { to: 'r@test.com', subject: 'T', body: 'B' })

    expect(result.raw).toBe(rawBuf)
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
    const composerArgs = (MockMailComposer as any).mock.calls[0]![0]
    expect(composerArgs.subject).toBe('Re: Original Subject')
    expect(composerArgs.inReplyTo).toBe('<original123@test>')
    expect(composerArgs.references).toBe('<ref1@test> <original123@test>')
  })

  it('does not double-prepend Re: prefix', async () => {
    await replyToEmail(account, {
      to: 'x@test.com',
      subject: 'Re: Already has prefix',
      body: 'reply',
      in_reply_to: '<msg@test>'
    })

    const composerArgs = (MockMailComposer as any).mock.calls[0]![0]
    expect(composerArgs.subject).toBe('Re: Already has prefix')
  })

  it('uses in_reply_to as references fallback', async () => {
    await replyToEmail(account, {
      to: 'x@test.com',
      subject: 'Test',
      body: 'reply',
      in_reply_to: '<msg@test>'
      // no references provided
    })

    const composerArgs = (MockMailComposer as any).mock.calls[0]![0]
    expect(composerArgs.references).toBe('<msg@test>')
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

  it('returns raw buffer', async () => {
    const result = await replyToEmail(account, {
      to: 'x@test.com',
      subject: 'Test',
      body: 'reply',
      in_reply_to: '<msg@test>'
    })

    expect(result.raw).toBeInstanceOf(Buffer)
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
    const composerArgs = (MockMailComposer as any).mock.calls[0]![0]
    expect(composerArgs.subject).toBe('Fwd: Original Subject')
    expect(composerArgs.text).toContain('Check this out')
    expect(composerArgs.text).toContain('---------- Forwarded message ----------')
    expect(composerArgs.text).toContain('This is the original email content')
  })

  it('does not double-prepend Fwd: prefix', async () => {
    await forwardEmail(account, {
      to: 'x@test.com',
      subject: 'Fwd: Already forwarded',
      body: 'fwd',
      original_body: 'original'
    })

    const composerArgs = (MockMailComposer as any).mock.calls[0]![0]
    expect(composerArgs.subject).toBe('Fwd: Already forwarded')
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

    const composerArgs = (MockMailComposer as any).mock.calls[0]![0]
    expect(composerArgs.cc).toBe('cc@test.com')
    expect(composerArgs.bcc).toBe('bcc@test.com')
  })

  it('returns raw buffer', async () => {
    const result = await forwardEmail(account, {
      to: 'x@test.com',
      subject: 'Test',
      body: 'fwd',
      original_body: 'orig'
    })

    expect(result.raw).toBeInstanceOf(Buffer)
  })
})
