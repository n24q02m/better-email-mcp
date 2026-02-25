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

describe('SMTP Client Security', () => {
  it('escapes HTML characters in body to prevent XSS', async () => {
    const maliciousBody = '<script>alert("xss")</script>'
    await sendNewEmail(account, {
      to: 'recipient@test.com',
      subject: 'Security Test',
      body: maliciousBody
    })

    const callArgs = mockSendMail.mock.calls[0]![0]
    expect(callArgs.html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
    expect(callArgs.html).not.toContain('<script>')
  })

  it('escapes HTML characters in headings', async () => {
    const maliciousHeading = '# <img src=x onerror=alert(1)>'
    await sendNewEmail(account, {
      to: 'recipient@test.com',
      subject: 'Heading Test',
      body: maliciousHeading
    })

    const callArgs = mockSendMail.mock.calls[0]![0]
    expect(callArgs.html).toContain('<h1>&lt;img src=x onerror=alert(1)&gt;</h1>')
    expect(callArgs.html).not.toContain('<img src=x')
  })

  it('escapes HTML characters in list items', async () => {
    const maliciousList = '- <a href="javascript:alert(1)">Click me</a>'
    await sendNewEmail(account, {
      to: 'recipient@test.com',
      subject: 'List Test',
      body: maliciousList
    })

    const callArgs = mockSendMail.mock.calls[0]![0]
    expect(callArgs.html).toContain('<li>&lt;a href=&quot;javascript:alert(1)&quot;&gt;Click me&lt;/a&gt;</li>')
    expect(callArgs.html).not.toContain('<a href=')
  })

  it('escapes HTML characters in bold text', async () => {
    const maliciousBold = '**<iframe src="javascript:alert(1)">**'
    await sendNewEmail(account, {
      to: 'recipient@test.com',
      subject: 'Bold Test',
      body: maliciousBold
    })

    const callArgs = mockSendMail.mock.calls[0]![0]
    expect(callArgs.html).toContain('<b>&lt;iframe src=&quot;javascript:alert(1)&quot;&gt;</b>')
    expect(callArgs.html).not.toContain('<iframe')
  })
})
