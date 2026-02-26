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

describe('sendNewEmail Security', () => {
  it('escapes XSS injection in email body', async () => {
    // This payload should be sanitized
    const maliciousBody = '<script>alert("XSS")</script>'

    await sendNewEmail(account, {
      to: 'victim@test.com',
      subject: 'Hello',
      body: maliciousBody
    })

    const callArgs = mockSendMail.mock.calls[0][0]

    // The script tag should be escaped
    expect(callArgs.html).toContain('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;')
    expect(callArgs.html).not.toContain('<script>')
  })

  it('escapes injection in headers', async () => {
    const maliciousHeader = '# <script>alert("H1")</script>'

    await sendNewEmail(account, {
      to: 'victim@test.com',
      subject: 'Hello',
      body: maliciousHeader
    })

    const callArgs = mockSendMail.mock.calls[0][0]
    expect(callArgs.html).toContain('<h1>&lt;script&gt;alert(&quot;H1&quot;)&lt;/script&gt;</h1>')
    expect(callArgs.html).not.toContain('<h1><script>')
  })
})
