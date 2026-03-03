import { createTransport } from 'nodemailer'
import { describe, expect, it, vi } from 'vitest'
import type { AccountConfig } from './config.js'
import { sendNewEmail } from './smtp-client.js'

vi.mock('nodemailer', () => ({
  createTransport: vi.fn(() => ({
    sendMail: vi.fn().mockResolvedValue({ messageId: 'test-id' }),
    close: vi.fn()
  }))
}))

describe('SMTP TLS Configuration', () => {
  it('should enforce requireTLS for providers using STARTTLS', async () => {
    // Outlook uses port 587 and secure: false (STARTTLS)
    const account: AccountConfig = {
      id: 'test',
      email: 'test@outlook.com',
      password: 'password123',
      imap: { host: 'outlook.office365.com', port: 993, secure: true },
      smtp: { host: 'smtp.office365.com', port: 587, secure: false, requireTLS: true }
    }

    await sendNewEmail(account, {
      to: 'recipient@example.com',
      subject: 'Test RequireTLS',
      body: 'This is a test'
    })

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.office365.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
          user: 'test@outlook.com',
          pass: 'password123'
        }
      })
    )
  })
})
