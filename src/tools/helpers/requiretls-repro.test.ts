import { describe, expect, it, vi } from 'vitest'

const mockCreateTransport = vi.fn().mockReturnValue({
  sendMail: vi.fn().mockResolvedValue({ messageId: '123' }),
  close: vi.fn()
})

vi.mock('nodemailer', () => {
  return {
    createTransport: (...args: any[]) => mockCreateTransport(...args)
  }
})

import { parseCredentials } from './config.js'
import { sendNewEmail } from './smtp-client.js'

describe('Vulnerability Fix: Missing Enforced TLS', () => {
  it('should enforce requireTLS for Outlook accounts', async () => {
    // 1. Parse Outlook credentials (which defaults to port 587, secure false)
    const accounts = parseCredentials('test@outlook.com:password123')
    expect(accounts).toHaveLength(1)

    const outlookAccount = accounts[0]!
    expect(outlookAccount.smtp.host).toBe('smtp.office365.com')
    expect(outlookAccount.smtp.port).toBe(587)
    expect(outlookAccount.smtp.secure).toBe(false)
    expect(outlookAccount.smtp.requireTLS).toBe(true)

    // 2. Send email to trigger transport creation
    await sendNewEmail(outlookAccount, {
      to: 'recipient@test.com',
      subject: 'Security test',
      body: 'Testing requireTLS'
    })

    // 3. Verify nodemailer was initialized securely
    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.office365.com',
        port: 587,
        secure: false,
        requireTLS: true // MUST BE ENFORCED to prevent MITM TLS downgrade
      })
    )
  })
})
