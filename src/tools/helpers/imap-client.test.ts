import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountConfig } from './config.js'

// --- Mocks (vi.hoisted ensures availability in vi.mock factory) ---
const { mockClient, mockRelease } = vi.hoisted(() => {
  const mockRelease = vi.fn()
  const mockClient = {
    connect: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    getMailboxLock: vi.fn().mockResolvedValue({ release: mockRelease }),
    fetch: vi.fn(),
    fetchOne: vi.fn(),
    messageFlagsAdd: vi.fn().mockResolvedValue(undefined),
    messageFlagsRemove: vi.fn().mockResolvedValue(undefined),
    messageMove: vi.fn().mockResolvedValue(undefined),
    messageDelete: vi.fn().mockResolvedValue(undefined),
    list: vi.fn()
  }
  return { mockClient, mockRelease }
})

vi.mock('imapflow', () => ({
  // biome-ignore lint/complexity/useArrowFunction: must use function keyword for `new` constructor mock
  ImapFlow: vi.fn(function () {
    return mockClient
  })
}))

vi.mock('mailparser', () => ({
  simpleParser: vi.fn()
}))

vi.mock('./html-utils.js', () => ({
  htmlToCleanText: vi.fn((html: string) => `cleaned: ${html}`)
}))

import { simpleParser } from 'mailparser'
import {
  getAttachment,
  listFolders,
  modifyFlags,
  moveEmails,
  readEmail,
  searchEmails,
  trashEmails
} from './imap-client.js'

const mockSimpleParser = vi.mocked(simpleParser)

const account: AccountConfig = {
  id: 'test_gmail_com',
  email: 'test@gmail.com',
  password: 'testpass',
  imap: { host: 'imap.gmail.com', port: 993, secure: true },
  smtp: { host: 'smtp.gmail.com', port: 465, secure: true }
}

/** Create async iterable from array (for ImapFlow.fetch) */
function toAsyncIterable<T>(items: T[]): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      let i = 0
      return {
        async next() {
          if (i < items.length) return { value: items[i++]!, done: false }
          return { value: undefined as any, done: true }
        }
      }
    }
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockClient.connect.mockResolvedValue(undefined)
  mockClient.logout.mockResolvedValue(undefined)
  mockClient.getMailboxLock.mockResolvedValue({ release: mockRelease })
  mockClient.messageFlagsAdd.mockResolvedValue(undefined)
  mockClient.messageFlagsRemove.mockResolvedValue(undefined)
  mockClient.messageMove.mockResolvedValue(undefined)
  mockClient.messageDelete.mockResolvedValue(undefined)
})

// ============================================================================
// searchEmails
// ============================================================================

describe('searchEmails', () => {
  it('searches with default UNSEEN criteria', async () => {
    mockSimpleParser.mockResolvedValue({ text: 'Preview text here' } as any)
    const msgs = [
      {
        uid: 1,
        flags: new Set(['\\Seen']),
        envelope: {
          messageId: '<msg1@test>',
          subject: 'Hello',
          from: [{ name: 'Sender', address: 'sender@test.com' }],
          to: [{ address: 'test@gmail.com' }],
          date: new Date('2025-01-01')
        },
        source: Buffer.from('Preview text here')
      }
    ]
    mockClient.fetch.mockReturnValue(toAsyncIterable(msgs))

    const results = await searchEmails([account], 'UNSEEN', 'INBOX', 20)

    expect(results).toHaveLength(1)
    expect(results[0]!.uid).toBe(1)
    expect(results[0]!.subject).toBe('Hello')
    expect(results[0]!.from).toContain('sender@test.com')
    expect(results[0]!.account_email).toBe('test@gmail.com')
    expect(results[0]!.snippet).toBe('Preview text here')
    expect(mockRelease).toHaveBeenCalled()
  })

  it('respects the limit parameter', async () => {
    mockSimpleParser.mockResolvedValue({ text: 'text' } as any)
    const msgs = Array.from({ length: 5 }, (_, i) => ({
      uid: i + 1,
      flags: new Set(),
      envelope: {
        messageId: `<msg${i + 1}@test>`,
        subject: `Email ${i + 1}`,
        from: [{ name: '', address: 'sender@test.com' }],
        to: [{ address: 'test@gmail.com' }],
        date: new Date()
      },
      source: Buffer.from('text')
    }))
    mockClient.fetch.mockReturnValue(toAsyncIterable(msgs))

    const results = await searchEmails([account], 'ALL', 'INBOX', 3)

    expect(results).toHaveLength(3)
  })

  it('searches across multiple accounts', async () => {
    mockSimpleParser.mockResolvedValue({ text: 'text' } as any)
    const account2: AccountConfig = {
      ...account,
      id: 'user2_gmail_com',
      email: 'user2@gmail.com'
    }
    const msg = {
      uid: 1,
      flags: new Set(),
      envelope: {
        subject: 'Test',
        from: [{ address: 'x@test.com' }],
        to: [{ address: 'y@test.com' }],
        date: new Date()
      },
      source: Buffer.from('text')
    }
    mockClient.fetch.mockReturnValue(toAsyncIterable([msg]))

    const results = await searchEmails([account, account2], 'ALL', 'INBOX', 10)

    // Should have results from both accounts
    expect(results).toHaveLength(2)
    expect(results[0]!.account_email).toBe('test@gmail.com')
    expect(results[1]!.account_email).toBe('user2@gmail.com')
  })

  it('includes error entry when account fails', async () => {
    mockClient.connect.mockRejectedValue(new Error('Connection refused'))

    const results = await searchEmails([account], 'ALL', 'INBOX', 10)

    expect(results).toHaveLength(1)
    expect(results[0]!.uid).toBe(0)
    expect(results[0]!.subject).toContain('[ERROR]')
    expect(results[0]!.snippet).toContain('Connection refused')
  })

  it('handles empty search results', async () => {
    mockClient.fetch.mockReturnValue(toAsyncIterable([]))

    const results = await searchEmails([account], 'UNSEEN', 'INBOX', 20)

    expect(results).toHaveLength(0)
  })

  it('uses source for snippet extraction', async () => {
    mockSimpleParser.mockResolvedValue({ text: 'Body content here' } as any)
    mockClient.fetch.mockReturnValue(
      toAsyncIterable([
        {
          uid: 1,
          flags: new Set(),
          envelope: { subject: 'Test Subject' },
          source: Buffer.from('Body content here')
        }
      ])
    )

    const results = await searchEmails([account], 'ALL', 'INBOX', 10)

    expect(results).toHaveLength(1)
    expect(results[0]!.snippet).toBe('Body content here')
  })

  it('handles missing envelope fields gracefully', async () => {
    mockSimpleParser.mockResolvedValue({ text: '' } as any)
    mockClient.fetch.mockReturnValue(
      toAsyncIterable([
        {
          uid: 1,
          flags: new Set(),
          envelope: {},
          source: null
        }
      ])
    )

    const results = await searchEmails([account], 'ALL', 'INBOX', 10)

    expect(results).toHaveLength(1)
    expect(results[0]!.subject).toBe('(No subject)')
    expect(results[0]!.from).toBe('')
    expect(results[0]!.snippet).toBe('')
  })
})

// ============================================================================
// readEmail
// ============================================================================

describe('readEmail', () => {
  it('reads email by UID and returns detail', async () => {
    mockClient.fetchOne.mockResolvedValue({
      uid: 42,
      flags: new Set(['\\Seen']),
      source: Buffer.from('raw email source')
    })
    mockSimpleParser.mockResolvedValue({
      messageId: '<msg42@test>',
      inReplyTo: '<parent@test>',
      references: '<ref1@test> <ref2@test>',
      subject: 'Test Subject',
      from: { text: 'Sender <sender@test.com>' },
      to: { text: 'test@gmail.com' },
      cc: undefined,
      bcc: undefined,
      date: new Date('2025-06-01'),
      text: 'Plain text body',
      html: null,
      attachments: [{ filename: 'doc.pdf', contentType: 'application/pdf', size: 1024 }]
    } as any)

    const result = await readEmail(account, 42, 'INBOX')

    expect(result.uid).toBe(42)
    expect(result.subject).toBe('Test Subject')
    expect(result.message_id).toBe('<msg42@test>')
    expect(result.body_text).toBe('Plain text body')
    expect(result.attachments).toHaveLength(1)
    expect(result.attachments[0]!.filename).toBe('doc.pdf')
    expect(mockRelease).toHaveBeenCalled()
  })

  it('falls back to html-to-text when no plain text', async () => {
    mockClient.fetchOne.mockResolvedValue({
      uid: 1,
      flags: new Set(),
      source: Buffer.from('raw')
    })
    mockSimpleParser.mockResolvedValue({
      subject: 'HTML Email',
      from: { text: 'x@test.com' },
      to: { text: 'y@test.com' },
      date: new Date(),
      text: null,
      html: '<p>Hello World</p>',
      attachments: []
    } as any)

    const result = await readEmail(account, 1, 'INBOX')

    expect(result.body_text).toBe('cleaned: <p>Hello World</p>')
  })

  it('shows (Empty body) when no text or html', async () => {
    mockClient.fetchOne.mockResolvedValue({
      uid: 1,
      flags: new Set(),
      source: Buffer.from('raw')
    })
    mockSimpleParser.mockResolvedValue({
      subject: 'Empty',
      from: { text: 'x@test.com' },
      to: { text: 'y@test.com' },
      date: new Date(),
      text: null,
      html: null,
      attachments: []
    } as any)

    const result = await readEmail(account, 1, 'INBOX')

    expect(result.body_text).toBe('(Empty body)')
  })

  it('throws EmailMCPError when email not found', async () => {
    mockClient.fetchOne.mockResolvedValue(false)

    await expect(readEmail(account, 999, 'INBOX')).rejects.toThrow('Email UID 999 not found')
  })

  it('throws when fetchOne returns object without source', async () => {
    mockClient.fetchOne.mockResolvedValue({ uid: 1, source: null })

    await expect(readEmail(account, 1, 'INBOX')).rejects.toThrow('not found')
  })
})

// ============================================================================
// modifyFlags
// ============================================================================

describe('modifyFlags', () => {
  it('adds flags to emails', async () => {
    const result = await modifyFlags(account, [1, 2, 3], 'INBOX', ['\\Seen'], 'add')

    expect(mockClient.messageFlagsAdd).toHaveBeenCalledWith({ uid: '1,2,3' }, ['\\Seen'])
    expect(result.success).toBe(true)
    expect(result.modified).toBe(3)
  })

  it('removes flags from emails', async () => {
    const result = await modifyFlags(account, [5], 'INBOX', ['\\Flagged'], 'remove')

    expect(mockClient.messageFlagsRemove).toHaveBeenCalledWith({ uid: '5' }, ['\\Flagged'])
    expect(result.success).toBe(true)
    expect(result.modified).toBe(1)
  })

  it('always releases the mailbox lock', async () => {
    mockClient.messageFlagsAdd.mockRejectedValue(new Error('fail'))

    await expect(modifyFlags(account, [1], 'INBOX', ['\\Seen'], 'add')).rejects.toThrow()

    expect(mockRelease).toHaveBeenCalled()
  })
})

// ============================================================================
// moveEmails
// ============================================================================

describe('moveEmails', () => {
  it('moves emails to destination folder', async () => {
    const result = await moveEmails(account, [1, 2], 'INBOX', 'Archive')

    expect(mockClient.messageMove).toHaveBeenCalledWith({ uid: '1,2' }, 'Archive')
    expect(result.success).toBe(true)
    expect(result.moved).toBe(2)
  })
})

// ============================================================================
// trashEmails
// ============================================================================

describe('trashEmails', () => {
  it('deletes emails from folder', async () => {
    const result = await trashEmails(account, [3, 4], 'INBOX')

    expect(mockClient.messageDelete).toHaveBeenCalledWith({ uid: '3,4' })
    expect(result.success).toBe(true)
    expect(result.trashed).toBe(2)
  })
})

// ============================================================================
// listFolders
// ============================================================================

describe('listFolders', () => {
  it('lists mailbox folders', async () => {
    mockClient.list.mockResolvedValue([
      { name: 'INBOX', path: 'INBOX', flags: new Set(['\\HasNoChildren']), delimiter: '/' },
      { name: '[Gmail]', path: '[Gmail]', flags: new Set(['\\Noselect']), delimiter: '/' }
    ])

    const result = await listFolders(account)

    expect(result).toHaveLength(2)
    expect(result[0]!.name).toBe('INBOX')
    expect(result[0]!.path).toBe('INBOX')
    expect(result[0]!.flags).toContain('\\HasNoChildren')
  })

  it('handles folders with children', async () => {
    const childFolders = new Map([
      [
        'Sent',
        {
          name: 'Sent',
          path: '[Gmail]/Sent',
          flags: new Set(['\\Sent']),
          delimiter: '/'
        }
      ]
    ])
    mockClient.list.mockResolvedValue([
      {
        name: '[Gmail]',
        path: '[Gmail]',
        flags: new Set(['\\Noselect']),
        delimiter: '/',
        folders: childFolders
      }
    ])

    const result = await listFolders(account)

    expect(result).toHaveLength(1)
    expect(result[0]!.children).toHaveLength(1)
    expect(result[0]!.children![0]!.name).toBe('Sent')
  })
})

// ============================================================================
// getAttachment
// ============================================================================

describe('getAttachment', () => {
  it('returns attachment as base64', async () => {
    const content = Buffer.from('file content')
    mockClient.fetchOne.mockResolvedValue({
      uid: 10,
      source: Buffer.from('raw email')
    })
    mockSimpleParser.mockResolvedValue({
      attachments: [
        {
          filename: 'report.pdf',
          contentType: 'application/pdf',
          size: 12345,
          content,
          contentId: 'cid123'
        }
      ]
    } as any)

    const result = await getAttachment(account, 10, 'INBOX', 'report.pdf')

    expect(result.filename).toBe('report.pdf')
    expect(result.content_type).toBe('application/pdf')
    expect(result.size).toBe(12345)
    expect(result.content_base64).toBe(content.toString('base64'))
  })

  it('matches attachment filename case-insensitively', async () => {
    mockClient.fetchOne.mockResolvedValue({ uid: 1, source: Buffer.from('raw') })
    mockSimpleParser.mockResolvedValue({
      attachments: [{ filename: 'Report.PDF', contentType: 'application/pdf', size: 100, content: Buffer.from('x') }]
    } as any)

    const result = await getAttachment(account, 1, 'INBOX', 'report.pdf')

    expect(result.filename).toBe('Report.PDF')
  })

  it('throws when email not found', async () => {
    mockClient.fetchOne.mockResolvedValue(false)

    await expect(getAttachment(account, 999, 'INBOX', 'file.txt')).rejects.toThrow('not found')
  })

  it('throws when attachment not found', async () => {
    mockClient.fetchOne.mockResolvedValue({ uid: 1, source: Buffer.from('raw') })
    mockSimpleParser.mockResolvedValue({
      attachments: [{ filename: 'other.txt', contentType: 'text/plain', size: 10, content: Buffer.from('x') }]
    } as any)

    await expect(getAttachment(account, 1, 'INBOX', 'missing.pdf')).rejects.toThrow('not found')
  })
})

// ============================================================================
// Connection lifecycle
// ============================================================================

describe('connection lifecycle', () => {
  it('always calls logout even on error', async () => {
    mockClient.fetchOne.mockRejectedValue(new Error('IMAP error'))

    await expect(readEmail(account, 1, 'INBOX')).rejects.toThrow()

    expect(mockClient.logout).toHaveBeenCalled()
  })

  it('ignores logout errors', async () => {
    mockClient.logout.mockRejectedValue(new Error('logout failed'))
    mockClient.fetchOne.mockResolvedValue({ uid: 1, source: Buffer.from('raw') })
    mockSimpleParser.mockResolvedValue({
      subject: 'Test',
      from: { text: 'x@test.com' },
      to: { text: 'y@test.com' },
      date: new Date(),
      text: 'body',
      attachments: []
    } as any)

    // Should not throw despite logout error
    const result = await readEmail(account, 1, 'INBOX')

    expect(result.subject).toBe('Test')
  })
})
