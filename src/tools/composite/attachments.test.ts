import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountConfig } from '../helpers/config.js'

// --- Mocks ---
vi.mock('../helpers/imap-client.js', () => ({
  readEmail: vi.fn(),
  getAttachment: vi.fn()
}))

import { getAttachment, readEmail } from '../helpers/imap-client.js'
import { attachments } from './attachments.js'

const mockReadEmail = vi.mocked(readEmail)
const mockGetAttachment = vi.mocked(getAttachment)

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
// list
// ============================================================================

describe('attachments - list', () => {
  it('lists attachments for an email', async () => {
    mockReadEmail.mockResolvedValue({
      account_id: 'user1_gmail_com',
      account_email: 'user1@gmail.com',
      uid: 10,
      subject: 'Email with files',
      from: 'sender@test.com',
      to: 'user1@gmail.com',
      date: '2025-01-01',
      flags: [],
      body_text: 'See attached',
      attachments: [
        { filename: 'doc.pdf', content_type: 'application/pdf', size: 1024 },
        { filename: 'img.png', content_type: 'image/png', size: 2048 }
      ]
    })

    const result = await attachments(accounts, {
      action: 'list',
      account: 'user1@gmail.com',
      uid: 10
    })

    expect(result.action).toBe('list')
    expect(result.total).toBe(2)
    expect(result.attachments).toHaveLength(2)
    expect(result.subject).toBe('Email with files')
  })

  it('returns empty list when no attachments', async () => {
    mockReadEmail.mockResolvedValue({
      account_id: 'user1_gmail_com',
      account_email: 'user1@gmail.com',
      uid: 10,
      subject: 'No files',
      from: 'x@test.com',
      to: 'y@test.com',
      date: '2025-01-01',
      flags: [],
      body_text: 'text',
      attachments: []
    })

    const result = await attachments(accounts, {
      action: 'list',
      account: 'user1@gmail.com',
      uid: 10
    })

    expect(result.total).toBe(0)
    expect(result.attachments).toHaveLength(0)
  })
})

// ============================================================================
// download
// ============================================================================

describe('attachments - download', () => {
  it('downloads attachment as base64', async () => {
    mockGetAttachment.mockResolvedValue({
      filename: 'report.pdf',
      content_type: 'application/pdf',
      size: 5000,
      content_base64: 'base64content'
    })

    const result = await attachments(accounts, {
      action: 'download',
      account: 'user1@gmail.com',
      uid: 10,
      filename: 'report.pdf'
    })

    expect(result.action).toBe('download')
    expect(result.content_base64).toBe('base64content')
    expect(result.filename).toBe('report.pdf')
  })

  it('throws when filename is missing', async () => {
    await expect(
      attachments(accounts, {
        action: 'download',
        account: 'user1@gmail.com',
        uid: 10
        // no filename
      })
    ).rejects.toThrow('filename is required')
  })
})

// ============================================================================
// validation
// ============================================================================

describe('attachments - validation', () => {
  it('throws when account is missing', async () => {
    await expect(
      attachments(accounts, {
        action: 'list',
        account: '',
        uid: 10
      })
    ).rejects.toThrow()
  })

  it('throws when uid is missing', async () => {
    await expect(
      attachments(accounts, {
        action: 'list',
        account: 'user1@gmail.com',
        uid: 0
      })
    ).rejects.toThrow()
  })

  it('throws when account not found', async () => {
    await expect(
      attachments(accounts, {
        action: 'list',
        account: 'nonexistent@test.com',
        uid: 10
      })
    ).rejects.toThrow('Account not found')
  })

  it('throws for unknown action', async () => {
    await expect(
      attachments(accounts, {
        action: 'unknown' as any,
        account: 'user1@gmail.com',
        uid: 10
      })
    ).rejects.toThrow()
  })
})
