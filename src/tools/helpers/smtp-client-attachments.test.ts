import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountConfig } from './config.js'

// Only mock the SMTP transport (avoid real network calls).
// MailComposer is NOT mocked here so raw MIME bytes are real —
// unlike smtp-client.test.ts, which stubs MailComposer entirely.
const { mockSendMail, mockClose } = vi.hoisted(() => ({
  mockSendMail: vi.fn(),
  mockClose: vi.fn()
}))

vi.mock('nodemailer', () => ({
  createTransport: vi.fn().mockImplementation(() => ({
    sendMail: mockSendMail,
    close: mockClose
  }))
}))

import { sendNewEmail } from './smtp-client.js'

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

describe('sendNewEmail attachments (real MIME)', () => {
  it('composes a message with one attachment', async () => {
    const contentBase64 = Buffer.from('PDF').toString('base64')

    const result = await sendNewEmail(account, {
      to: 'b@y',
      subject: 's',
      body: 't',
      attachments: [{ filename: 'report.pdf', content_base64: contentBase64, content_type: 'application/pdf' }]
    })

    const raw = result.raw!.toString()
    expect(raw).toContain('Content-Disposition: attachment; filename=report.pdf')
    expect(raw).toContain(contentBase64)
    expect(mockSendMail).toHaveBeenCalled()
  })

  it('rejects attachments whose total decoded size exceeds 25MB without calling SMTP', async () => {
    // ~26MB of base64 chars decodes to ~19.5MB... use enough chars to exceed 25MB decoded.
    const oversizedBase64 = 'A'.repeat(Math.ceil((26 * 1024 * 1024 * 4) / 3))

    await expect(
      sendNewEmail(account, {
        to: 'b@y',
        subject: 's',
        body: 't',
        attachments: [{ filename: 'big.bin', content_base64: oversizedBase64 }]
      })
    ).rejects.toThrow(/attachment/i)

    expect(mockSendMail).not.toHaveBeenCalled()
  })

  it('rejects more than 10 attachments without calling SMTP', async () => {
    const attachments = Array.from({ length: 11 }, (_, i) => ({
      filename: `f${i}.txt`,
      content_base64: Buffer.from('x').toString('base64')
    }))

    await expect(sendNewEmail(account, { to: 'b@y', subject: 's', body: 't', attachments })).rejects.toThrow(
      /too many attachments/i
    )

    expect(mockSendMail).not.toHaveBeenCalled()
  })

  it('does not add an attachments field to the raw message when none are provided', async () => {
    const result = await sendNewEmail(account, { to: 'b@y', subject: 's', body: 't' })

    const raw = result.raw!.toString()
    expect(raw).not.toContain('Content-Disposition: attachment')
  })
})
