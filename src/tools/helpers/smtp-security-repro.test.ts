import { describe, it, expect, vi } from 'vitest'
import { parseCredentials } from './config.js'
import { sendNewEmail } from './smtp-client.js'
import * as nodemailer from 'nodemailer'

vi.mock('nodemailer', () => {
  return {
    createTransport: vi.fn().mockReturnValue({
      sendMail: vi.fn().mockResolvedValue({ messageId: 'test-id' }),
      close: vi.fn(),
    })
  }
})

describe('SMTP Security Configuration', () => {
  it('should set requireTLS for outlook.com', async () => {
    const accounts = parseCredentials('test@outlook.com:password')
    expect(accounts[0].smtp.requireTLS).toBe(true)

    await sendNewEmail(accounts[0], { to: 'test@test.com', subject: 'Test', body: 'Test' })
    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
      requireTLS: true,
      secure: false
    }))
  })

  it('should set requireTLS for icloud.com', async () => {
    const accounts = parseCredentials('test@icloud.com:password')
    expect(accounts[0].smtp.requireTLS).toBe(true)

    await sendNewEmail(accounts[0], { to: 'test@test.com', subject: 'Test', body: 'Test' })
    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
      requireTLS: true,
      secure: false
    }))
  })

  it('should set requireTLS for custom IMAP hosts using port 587', async () => {
    const accounts = parseCredentials('test@custom.com:password:imap.custom.com')
    expect(accounts[0].smtp.requireTLS).toBe(true)

    await sendNewEmail(accounts[0], { to: 'test@test.com', subject: 'Test', body: 'Test' })
    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
      requireTLS: true,
      secure: false
    }))
  })
})
