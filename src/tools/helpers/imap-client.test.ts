import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountConfig } from './config.js'

// --- Mocks (vi.hoisted ensures availability in vi.mock factory) ---
const { mockClient, mockRelease } = vi.hoisted(() => {
  const mockRelease = vi.fn()
  const mockClient = {
    connect: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    getMailboxLock: vi.fn().mockResolvedValue({ release: mockRelease }),
    search: vi.fn().mockResolvedValue([1]),
    fetch: vi.fn(),
    fetchAll: vi.fn(),
    fetchOne: vi.fn(),
    messageFlagsAdd: vi.fn().mockResolvedValue(undefined),
    messageFlagsRemove: vi.fn().mockResolvedValue(undefined),
    messageMove: vi.fn().mockResolvedValue(undefined),
    messageDelete: vi.fn().mockResolvedValue(undefined),
    list: vi.fn(),
    append: vi.fn().mockResolvedValue({ destination: 'Sent', uid: 1 })
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

vi.mock('./html-utils.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./html-utils.js')>()),
  htmlToCleanText: vi.fn((html: string) => `cleaned: ${html}`)
}))

vi.mock('./oauth2.js', () => ({
  ensureValidToken: vi.fn().mockResolvedValue('mock-access-token')
}))

import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import {
  appendToFolder,
  clearSentFolderCache,
  getAttachment,
  listFolders,
  modifyFlags,
  moveEmails,
  readEmail,
  resolveSentFolder,
  searchEmails,
  trashEmails
} from './imap-client.js'
import { ensureValidToken } from './oauth2.js'

const mockSimpleParser = vi.mocked(simpleParser)

const account: AccountConfig = {
  id: 'test_gmail_com',
  email: 'test@gmail.com',
  password: 'testpass',
  imap: { host: 'imap.gmail.com', port: 993, secure: true },
  smtp: { host: 'smtp.gmail.com', port: 465, secure: true }
}

/** Create async iterable from array (for ImapFlow.fetch) */
function _toAsyncIterable<T>(items: T[]): AsyncIterable<T> {
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
  clearSentFolderCache()
  mockClient.connect.mockResolvedValue(undefined)
  mockClient.logout.mockResolvedValue(undefined)
  mockClient.getMailboxLock.mockResolvedValue({ release: mockRelease })
  mockClient.search.mockResolvedValue([1])
  mockClient.messageFlagsAdd.mockResolvedValue(undefined)
  mockClient.messageFlagsRemove.mockResolvedValue(undefined)
  mockClient.messageMove.mockResolvedValue(undefined)
  mockClient.messageDelete.mockResolvedValue(undefined)
})

// ============================================================================
// searchEmails
// ============================================================================

describe('searchEmails', () => {
  const setupSearch = () => {
    mockClient.search.mockResolvedValue([123, 456])
    mockClient.fetchAll.mockResolvedValue([
      {
        uid: 123,
        envelope: {
          subject: 'Test Subject',
          from: [{ name: 'Sender', address: 'sender@example.com' }],
          to: [{ address: 'recipient@example.com' }],
          date: new Date('2024-01-01T10:00:00Z'),
          messageId: 'msg-123'
        },
        flags: new Set(['\\Seen'])
      }
    ])
  }

  it('searches with default UNSEEN criteria', async () => {
    setupSearch()
    const results = await searchEmails([account], 'UNSEEN', 'INBOX', 10)

    expect(results).toHaveLength(1)
    expect(results[0].subject).toBe('Test Subject')
    expect(mockClient.search).toHaveBeenCalledWith({ seen: false }, { uid: true })
  })

  it('respects the limit parameter', async () => {
    mockClient.search.mockResolvedValue([1, 2, 3, 4, 5])
    mockClient.fetchAll.mockResolvedValue([])

    await searchEmails([account], 'ALL', 'INBOX', 2)

    // selectedUids should be the last 2: [4, 5]
    expect(mockClient.fetchAll).toHaveBeenCalledWith([4, 5], expect.any(Object), { uid: true })
  })

  it('searches across multiple accounts', async () => {
    setupSearch()
    const account2 = { ...account, id: 'acc2', email: 'acc2@test.com' }
    const results = await searchEmails([account, account2], 'ALL', 'INBOX', 10)

    expect(results).toHaveLength(2)
    expect(ImapFlow).toHaveBeenCalledTimes(2)
  })

  it('includes error entry when account fails', async () => {
    mockClient.connect.mockRejectedValueOnce(new Error('Connection failed'))
    const results = await searchEmails([account], 'ALL', 'INBOX', 10)

    expect(results).toHaveLength(1)
    expect(results[0].subject).toContain('[ERROR]')
    expect(results[0].snippet).toContain('Connection failed')
  })

  it('handles empty search results', async () => {
    mockClient.search.mockResolvedValue([])
    const results = await searchEmails([account], 'ALL', 'INBOX', 10)

    expect(results).toHaveLength(0)
    expect(mockClient.fetchAll).not.toHaveBeenCalled()
  })

  it('uses source for snippet extraction', async () => {
    mockClient.search.mockResolvedValue([1])
    mockClient.fetchAll.mockResolvedValue([
      {
        uid: 1,
        source: Buffer.from('Subject: test\r\n\r\nHello World'),
        envelope: { subject: 'test' }
      }
    ])

    mockSimpleParser.mockResolvedValue({ text: 'Hello World' } as any)

    const results = await searchEmails([account], 'ALL', 'INBOX', 1)
    expect(results[0].snippet).toBe('Hello World')
  })

  it('handles missing envelope fields gracefully', async () => {
    mockClient.search.mockResolvedValue([1])
    mockClient.fetchAll.mockResolvedValue([
      {
        uid: 1,
        envelope: {} // Missing everything
      }
    ])

    const results = await searchEmails([account], 'ALL', 'INBOX', 1)
    expect(results[0].subject).toBe('(No subject)')
    expect(results[0].from).toBe('')
    expect(results[0].to).toBe('')
  })
})

// ============================================================================
// readEmail
// ============================================================================

describe('readEmail', () => {
  const mockSource = Buffer.from('From: sender@test.com\r\nSubject: Test\r\n\r\nBody Content')

  it('reads email by UID and returns detail', async () => {
    mockClient.fetchOne.mockResolvedValue({
      uid: 123,
      flags: new Set(['\\Seen', '\\Flagged']),
      source: mockSource
    })

    mockSimpleParser.mockResolvedValue({
      subject: 'Test Subject',
      from: { text: 'sender@test.com', value: [{ name: '', address: 'sender@test.com' }] },
      to: { text: 'to@test.com', value: [{ name: '', address: 'to@test.com' }] },
      date: new Date('2024-01-01T10:00:00Z'),
      text: 'Body Content',
      messageId: 'id-123',
      attachments: []
    } as any)

    const result = await readEmail(account, 123, 'INBOX')

    expect(result.uid).toBe(123)
    expect(result.body_text).toBe('Body Content')
    expect(result.flags).toContain('\\Seen')
    expect(result.flags).toContain('\\Flagged')
  })

  it('falls back to html-to-text when no plain text', async () => {
    mockClient.fetchOne.mockResolvedValue({ uid: 1, source: mockSource })
    mockSimpleParser.mockResolvedValue({
      html: '<p>HTML Content</p>',
      text: undefined
    } as any)

    const result = await readEmail(account, 1, 'INBOX')
    expect(result.body_text).toBe('cleaned: <p>HTML Content</p>')
  })

  it('shows (Empty body) when no text or html', async () => {
    mockClient.fetchOne.mockResolvedValue({ uid: 1, source: mockSource })
    mockSimpleParser.mockResolvedValue({} as any)

    const result = await readEmail(account, 1, 'INBOX')
    expect(result.body_text).toBe('(Empty body)')
  })

  it('throws EmailMCPError when email not found', async () => {
    mockClient.fetchOne.mockResolvedValue(null)
    await expect(readEmail(account, 999, 'INBOX')).rejects.toThrow('not found')
  })

  it('throws when fetchOne returns object without source', async () => {
    mockClient.fetchOne.mockResolvedValue({ uid: 123 }) // source missing
    await expect(readEmail(account, 123, 'INBOX')).rejects.toThrow('not found')
  })
})

// ============================================================================
// modifyFlags
// ============================================================================

describe('modifyFlags', () => {
  it('adds flags to emails', async () => {
    const result = await modifyFlags(account, [1, 2], 'INBOX', ['\\Seen'], 'add')
    expect(result.success).toBe(true)
    expect(mockClient.messageFlagsAdd).toHaveBeenCalledWith({ uid: '1,2' }, ['\\Seen'])
  })

  it('removes flags from emails', async () => {
    const result = await modifyFlags(account, [3], 'INBOX', ['\\Flagged'], 'remove')
    expect(result.success).toBe(true)
    expect(mockClient.messageFlagsRemove).toHaveBeenCalledWith({ uid: '3' }, ['\\Flagged'])
  })

  it('always releases the mailbox lock', async () => {
    await modifyFlags(account, [1], 'INBOX', ['\\Seen'], 'add')
    expect(mockRelease).toHaveBeenCalled()
  })
})

// ============================================================================
// moveEmails
// ============================================================================

describe('moveEmails', () => {
  it('moves emails to destination folder', async () => {
    const result = await moveEmails(account, [1], 'INBOX', 'Archive')
    expect(result.success).toBe(true)
    expect(mockClient.messageMove).toHaveBeenCalledWith({ uid: '1' }, 'Archive')
  })
})

// ============================================================================
// trashEmails
// ============================================================================

describe('trashEmails', () => {
  it('deletes emails from folder', async () => {
    const result = await trashEmails(account, [1, 2], 'INBOX')
    expect(result.success).toBe(true)
    expect(mockClient.messageDelete).toHaveBeenCalledWith({ uid: '1,2' })
  })
})

// ============================================================================
// listFolders
// ============================================================================

describe('listFolders', () => {
  it('lists mailbox folders', async () => {
    mockClient.list.mockResolvedValue([
      { name: 'Inbox', path: 'INBOX', flags: new Set(['\\HasNoChildren']), delimiter: '/' }
    ])
    const result = await listFolders(account)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Inbox')
  })
})

// ============================================================================
// getAttachment
// ============================================================================

describe('getAttachment', () => {
  it('returns attachment as base64', async () => {
    mockClient.fetchOne.mockResolvedValue({ uid: 1, source: Buffer.from('...') })
    mockSimpleParser.mockResolvedValue({
      attachments: [
        {
          filename: 'test.pdf',
          contentType: 'application/pdf',
          size: 100,
          content: Buffer.from('pdf-data')
        }
      ]
    } as any)

    const result = await getAttachment(account, 1, 'INBOX', 'test.pdf')
    expect(result.filename).toBe('test.pdf')
    expect(result.content_base64).toBe(Buffer.from('pdf-data').toString('base64'))
  })

  it('matches attachment filename case-insensitively', async () => {
    mockClient.fetchOne.mockResolvedValue({ uid: 1, source: Buffer.from('...') })
    mockSimpleParser.mockResolvedValue({
      attachments: [{ filename: 'LARGE.JPG', content: Buffer.from('...'), size: 10 }]
    } as any)

    const result = await getAttachment(account, 1, 'INBOX', 'large.jpg')
    expect(result.filename).toBe('LARGE.JPG')
  })

  it('throws when email not found', async () => {
    mockClient.fetchOne.mockResolvedValue(null)
    await expect(getAttachment(account, 1, 'INBOX', 'any.txt')).rejects.toThrow('not found')
  })

  it('throws when attachment not found', async () => {
    mockClient.fetchOne.mockResolvedValue({ uid: 1, source: Buffer.from('...') })
    mockSimpleParser.mockResolvedValue({ attachments: [] } as any)
    await expect(getAttachment(account, 1, 'INBOX', 'missing.txt')).rejects.toThrow('not found')
  })
})

// ============================================================================
// withConnection error handling
// ============================================================================

describe('withConnection error handling', () => {
  it('always calls logout even on error', async () => {
    mockClient.connect.mockResolvedValue(undefined)
    mockClient.list.mockRejectedValue(new Error('Work failed'))

    await expect(listFolders(account)).rejects.toThrow('Work failed')
    expect(mockClient.logout).toHaveBeenCalled()
  })

  it('ignores logout errors', async () => {
    mockClient.logout.mockRejectedValue(new Error('Logout failed'))
    // Should still resolve normally (or throw the original error)
    mockClient.list.mockResolvedValue([])
    await expect(listFolders(account)).resolves.not.toThrow()
  })
})

// ============================================================================
// extractSnippet (private via searchEmails)
// ============================================================================

describe('extractSnippet', () => {
  it('uses HTML fallback when text is null but html exists', async () => {
    mockClient.search.mockResolvedValue([1])
    mockClient.fetchAll.mockResolvedValue([{ uid: 1, source: Buffer.from('...') }])
    mockSimpleParser.mockResolvedValue({
      text: null,
      html: '<div>Important Info</div>'
    } as any)

    const results = await searchEmails([account], 'ALL', 'INBOX', 1)
    expect(results[0].snippet).toBe('Important Info')
  })

  it('truncates snippet with ... when text exceeds 200 chars', async () => {
    const longText = 'a'.repeat(250)
    mockClient.search.mockResolvedValue([1])
    mockClient.fetchAll.mockResolvedValue([{ uid: 1, source: Buffer.from('...') }])
    mockSimpleParser.mockResolvedValue({ text: longText } as any)

    const results = await searchEmails([account], 'ALL', 'INBOX', 1)
    expect(results[0].snippet).toHaveLength(203)
    expect(results[0].snippet.endsWith('...')).toBe(true)
  })

  it('returns empty string when simpleParser throws', async () => {
    mockClient.search.mockResolvedValue([1])
    mockClient.fetchAll.mockResolvedValue([{ uid: 1, source: Buffer.from('...') }])
    mockSimpleParser.mockRejectedValue(new Error('Parser failed'))

    const results = await searchEmails([account], 'ALL', 'INBOX', 1)
    expect(results[0].snippet).toBe('')
  })

  it('returns empty string when text is empty after parsing', async () => {
    mockClient.search.mockResolvedValue([1])
    mockClient.fetchAll.mockResolvedValue([{ uid: 1, source: Buffer.from('...') }])
    mockSimpleParser.mockResolvedValue({ text: '   ', html: '  ' } as any)

    const results = await searchEmails([account], 'ALL', 'INBOX', 1)
    expect(results[0].snippet).toBe('')
  })
})

// ============================================================================
// formatAddress
// ============================================================================

describe('formatAddress', () => {
  it('returns the string directly when addr is a string', async () => {
    mockClient.fetchOne.mockResolvedValue({ uid: 1, source: Buffer.from('...') })
    mockSimpleParser.mockResolvedValue({ from: 'direct@test.com' } as any)
    const res = await readEmail(account, 1, 'INBOX')
    expect(res.from).toBe('direct@test.com')
  })

  it('returns addr.text when present', async () => {
    mockClient.fetchOne.mockResolvedValue({ uid: 1, source: Buffer.from('...') })
    mockSimpleParser.mockResolvedValue({ from: { text: 'Text Label <addr@test.com>' } } as any)
    const res = await readEmail(account, 1, 'INBOX')
    expect(res.from).toBe('Text Label <addr@test.com>')
  })

  it('formats value array with name', async () => {
    mockClient.fetchOne.mockResolvedValue({ uid: 1, source: Buffer.from('...') })
    mockSimpleParser.mockResolvedValue({
      from: { value: [{ name: 'John Doe', address: 'john@test.com' }] }
    } as any)
    const res = await readEmail(account, 1, 'INBOX')
    expect(res.from).toBe('John Doe <john@test.com>')
  })

  it('formats value array without name', async () => {
    mockClient.fetchOne.mockResolvedValue({ uid: 1, source: Buffer.from('...') })
    mockSimpleParser.mockResolvedValue({
      from: { value: [{ name: '', address: 'anon@test.com' }] }
    } as any)
    const res = await readEmail(account, 1, 'INBOX')
    expect(res.from).toBe('anon@test.com')
  })

  it('formats value array with multiple entries', async () => {
    mockClient.fetchOne.mockResolvedValue({ uid: 1, source: Buffer.from('...') })
    mockSimpleParser.mockResolvedValue({
      from: {
        value: [
          { name: 'A', address: 'a@test.com' },
          { name: '', address: 'b@test.com' }
        ]
      }
    } as any)
    const res = await readEmail(account, 1, 'INBOX')
    expect(res.from).toBe('A <a@test.com>, b@test.com')
  })

  it('returns empty string for null/undefined addr', async () => {
    mockClient.fetchOne.mockResolvedValue({ uid: 1, source: Buffer.from('...') })
    mockSimpleParser.mockResolvedValue({ from: null } as any)
    const res = await readEmail(account, 1, 'INBOX')
    expect(res.from).toBe('')
  })

  it('returns empty string for object with no text or value', async () => {
    mockClient.fetchOne.mockResolvedValue({ uid: 1, source: Buffer.from('...') })
    mockSimpleParser.mockResolvedValue({ from: {} } as any)
    const res = await readEmail(account, 1, 'INBOX')
    expect(res.from).toBe('')
  })
})

// ============================================================================
// buildSearchCriteria
// ============================================================================

describe('buildSearchCriteria', () => {
  const setupSearch = () => {
    mockClient.search.mockResolvedValue([])
  }

  it('maps READ to { seen: true }', async () => {
    setupSearch()
    await searchEmails([account], 'READ', 'INBOX', 10)
    expect(mockClient.search).toHaveBeenCalledWith({ seen: true }, { uid: true })
  })

  it('maps SEEN to { seen: true }', async () => {
    setupSearch()
    await searchEmails([account], 'SEEN', 'INBOX', 10)
    expect(mockClient.search).toHaveBeenCalledWith({ seen: true }, { uid: true })
  })

  it('maps FLAGGED to { flagged: true }', async () => {
    setupSearch()
    await searchEmails([account], 'FLAGGED', 'INBOX', 10)
    expect(mockClient.search).toHaveBeenCalledWith({ flagged: true }, { uid: true })
  })

  it('maps STARRED to { flagged: true }', async () => {
    setupSearch()
    await searchEmails([account], 'STARRED', 'INBOX', 10)
    expect(mockClient.search).toHaveBeenCalledWith({ flagged: true }, { uid: true })
  })

  it('maps UNFLAGGED to { flagged: false }', async () => {
    setupSearch()
    await searchEmails([account], 'UNFLAGGED', 'INBOX', 10)
    expect(mockClient.search).toHaveBeenCalledWith({ flagged: false }, { uid: true })
  })

  it('maps UNSTARRED to { flagged: false }', async () => {
    setupSearch()
    await searchEmails([account], 'UNSTARRED', 'INBOX', 10)
    expect(mockClient.search).toHaveBeenCalledWith({ flagged: false }, { uid: true })
  })

  it('maps ALL to {}', async () => {
    setupSearch()
    await searchEmails([account], 'ALL', 'INBOX', 10)
    expect(mockClient.search).toHaveBeenCalledWith({}, { uid: true })
  })

  it('maps * to {}', async () => {
    setupSearch()
    await searchEmails([account], '*', 'INBOX', 10)
    expect(mockClient.search).toHaveBeenCalledWith({}, { uid: true })
  })

  it('maps SINCE date to { since: Date }', async () => {
    setupSearch()
    await searchEmails([account], 'SINCE 2024-01-01', 'INBOX', 10)
    expect(mockClient.search).toHaveBeenCalledWith({ since: new Date('2024-01-01') }, { uid: true })
  })

  it('maps FROM to { from: string }', async () => {
    setupSearch()
    await searchEmails([account], 'FROM boss@test.com', 'INBOX', 10)
    expect(mockClient.search).toHaveBeenCalledWith({ from: 'boss@test.com' }, { uid: true })
  })

  it('maps SUBJECT to { subject: string }', async () => {
    setupSearch()
    await searchEmails([account], 'SUBJECT urgent', 'INBOX', 10)
    expect(mockClient.search).toHaveBeenCalledWith({ subject: 'urgent' }, { uid: true })
  })

  it('maps UNREAD SINCE to compound criteria', async () => {
    setupSearch()
    await searchEmails([account], 'UNREAD SINCE 2024-05-01', 'INBOX', 10)
    expect(mockClient.search).toHaveBeenCalledWith({ seen: false, since: new Date('2024-05-01') }, { uid: true })
  })

  it('maps UNREAD FROM to compound criteria', async () => {
    setupSearch()
    await searchEmails([account], 'UNREAD FROM marketing@test.com', 'INBOX', 10)
    expect(mockClient.search).toHaveBeenCalledWith({ seen: false, from: 'marketing@test.com' }, { uid: true })
  })

  it('falls back to subject search for plain text', async () => {
    setupSearch()
    await searchEmails([account], 'meeting notes', 'INBOX', 10)
    expect(mockClient.search).toHaveBeenCalledWith({ subject: 'meeting notes' }, { uid: true })
  })

  // Compound queries (issue #298)
  it('maps FROM x SINCE date to compound criteria', async () => {
    setupSearch()
    await searchEmails([account], 'FROM sshrien SINCE 2026-03-01', 'INBOX', 10)
    expect(mockClient.search).toHaveBeenCalledWith({ from: 'sshrien', since: new Date('2026-03-01') }, { uid: true })
  })

  it('maps FROM x SINCE date UNREAD to compound criteria', async () => {
    setupSearch()
    await searchEmails([account], 'FROM user@test.com SINCE 2024-01-01 UNREAD', 'INBOX', 10)
    expect(mockClient.search).toHaveBeenCalledWith(
      { from: 'user@test.com', since: new Date('2024-01-01'), seen: false },
      { uid: true }
    )
  })

  it('maps SINCE date BEFORE date to date range', async () => {
    setupSearch()
    await searchEmails([account], 'SINCE 2024-01-01 BEFORE 2024-02-01', 'INBOX', 10)
    expect(mockClient.search).toHaveBeenCalledWith(
      { since: new Date('2024-01-01'), before: new Date('2024-02-01') },
      { uid: true }
    )
  })

  it('maps FLAGGED FROM x to compound criteria', async () => {
    setupSearch()
    await searchEmails([account], 'FLAGGED FROM boss@company.com', 'INBOX', 10)
    expect(mockClient.search).toHaveBeenCalledWith({ flagged: true, from: 'boss@company.com' }, { uid: true })
  })

  it('maps TO x SINCE date to compound criteria', async () => {
    setupSearch()
    await searchEmails([account], 'TO team@company.com SINCE 2024-06-01', 'INBOX', 10)
    expect(mockClient.search).toHaveBeenCalledWith(
      { to: 'team@company.com', since: new Date('2024-06-01') },
      { uid: true }
    )
  })

  it('handles FROM with quoted value', async () => {
    setupSearch()
    await searchEmails([account], 'FROM "john@test.com"', 'INBOX', 10)
    expect(mockClient.search).toHaveBeenCalledWith({ from: 'john@test.com' }, { uid: true })
  })

  it('handles SUBJECT with remaining text in compound query', async () => {
    setupSearch()
    await searchEmails([account], 'UNREAD SUBJECT meeting agenda', 'INBOX', 10)
    expect(mockClient.search).toHaveBeenCalledWith({ seen: false, subject: 'meeting agenda' }, { uid: true })
  })

  it('maps BEFORE date to { before: Date }', async () => {
    setupSearch()
    await searchEmails([account], 'BEFORE 2024-06-01', 'INBOX', 10)
    expect(mockClient.search).toHaveBeenCalledWith({ before: new Date('2024-06-01') }, { uid: true })
  })

  it('throws on invalid BEFORE date format', async () => {
    await expect(searchEmails([account], 'BEFORE Jan 15', 'INBOX', 10)).rejects.toThrow('Invalid date format')
  })

  it('throws on invalid SINCE date format', async () => {
    await expect(searchEmails([account], 'SINCE 01/15/2026', 'INBOX', 10)).rejects.toThrow('Invalid date format')
  })

  it('returns empty criteria for empty string', async () => {
    setupSearch()
    await searchEmails([account], '', 'INBOX', 10)
    expect(mockClient.search).toHaveBeenCalledWith({}, { uid: true })
  })
})

// ============================================================================
// resolveSentFolder
// ============================================================================

describe('resolveSentFolder', () => {
  it('returns [Gmail]/Sent Mail for Gmail accounts', async () => {
    mockClient.list.mockResolvedValue([
      { name: 'Sent Mail', path: '[Gmail]/Sent Mail', flags: new Set(['\\Sent']), delimiter: '/' }
    ])

    const result = await resolveSentFolder(account)

    expect(result).toBe('[Gmail]/Sent Mail')
  })

  it('returns Sent Items for Outlook accounts', async () => {
    const outlookAccount: AccountConfig = {
      id: 'test_outlook_com',
      email: 'test@outlook.com',
      password: 'testpass',
      imap: { host: 'outlook.office365.com', port: 993, secure: true },
      smtp: { host: 'smtp.office365.com', port: 587, secure: false }
    }
    mockClient.list.mockResolvedValue([
      { name: 'Sent Items', path: 'Sent Items', flags: new Set(['\\Sent']), delimiter: '/' }
    ])

    const result = await resolveSentFolder(outlookAccount)

    expect(result).toBe('Sent Items')
  })

  it('defaults to Sent for unknown providers', async () => {
    const customAccount: AccountConfig = {
      id: 'test_custom_com',
      email: 'test@custom.com',
      password: 'testpass',
      imap: { host: 'imap.custom.com', port: 993, secure: true },
      smtp: { host: 'smtp.custom.com', port: 465, secure: true }
    }
    mockClient.list.mockResolvedValue([{ name: 'Sent', path: 'Sent', flags: new Set(['\\Sent']), delimiter: '/' }])

    const result = await resolveSentFolder(customAccount)

    expect(result).toBe('Sent')
  })

  it('detects sent folder via \\Sent flag', async () => {
    const customAccount: AccountConfig = {
      id: 'test_zoho_com',
      email: 'test@zoho.com',
      password: 'testpass',
      imap: { host: 'imap.zoho.com', port: 993, secure: true },
      smtp: { host: 'smtp.zoho.com', port: 465, secure: true }
    }
    mockClient.list.mockResolvedValue([
      { name: 'SentMail', path: 'SentMail', flags: new Set(['\\Sent']), delimiter: '/' }
    ])

    const result = await resolveSentFolder(customAccount)

    expect(result).toBe('SentMail')
  })

  it('uses default when folder listing fails', async () => {
    const customAccount: AccountConfig = {
      id: 'test_fail_com',
      email: 'test@fail.com',
      password: 'testpass',
      imap: { host: 'imap.fail.com', port: 993, secure: true },
      smtp: { host: 'smtp.fail.com', port: 465, secure: true }
    }
    mockClient.connect.mockRejectedValueOnce(new Error('IMAP failed'))

    const result = await resolveSentFolder(customAccount)

    expect(result).toBe('Sent')
  })
})

// ============================================================================
// appendToFolder
// ============================================================================

describe('appendToFolder', () => {
  it('appends message to folder with \\Seen flag', async () => {
    const message = Buffer.from('raw RFC2822 message')

    const result = await appendToFolder(account, 'Sent', message)

    expect(result).toBe(true)
    expect(mockClient.append).toHaveBeenCalledWith('Sent', message, ['\\Seen'], expect.any(Date))
  })

  it('uses custom flags when provided', async () => {
    const message = Buffer.from('raw message')

    await appendToFolder(account, '[Gmail]/Sent Mail', message, ['\\Seen', '\\Flagged'])

    expect(mockClient.append).toHaveBeenCalledWith(
      '[Gmail]/Sent Mail',
      message,
      ['\\Seen', '\\Flagged'],
      expect.any(Date)
    )
  })

  it('returns false when append returns false', async () => {
    mockClient.append.mockResolvedValue(false)

    const result = await appendToFolder(account, 'Sent', Buffer.from('msg'))

    expect(result).toBe(false)
  })

  it('propagates errors from IMAP connection', async () => {
    mockClient.append.mockRejectedValue(new Error('IMAP APPEND failed'))

    await expect(appendToFolder(account, 'Sent', Buffer.from('msg'))).rejects.toThrow('IMAP APPEND failed')
  })
})

// ============================================================================
// OAuth2 IMAP authentication
// ============================================================================

describe('OAuth2 IMAP authentication', () => {
  const oauth2Account: AccountConfig = {
    id: 'test_outlook_com',
    email: 'test@outlook.com',
    password: '',
    authType: 'oauth2',
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
    smtp: { host: 'smtp.office365.com', port: 587, secure: false },
    oauth2: {
      accessToken: 'outlook-access-token',
      refreshToken: 'outlook-refresh-token',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      clientId: 'test-client-id'
    }
  }

  it('calls ensureValidToken before connecting for OAuth2 accounts', async () => {
    mockClient.list.mockResolvedValue([])

    await listFolders(oauth2Account)

    expect(ensureValidToken).toHaveBeenCalledWith(oauth2Account)
  })

  it('creates ImapFlow with accessToken for OAuth2 accounts', async () => {
    mockClient.list.mockResolvedValue([])

    await listFolders(oauth2Account)

    expect(ImapFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: { user: 'test@outlook.com', accessToken: 'outlook-access-token' }
      })
    )
  })

  it('creates ImapFlow with password for non-OAuth2 accounts', async () => {
    mockClient.list.mockResolvedValue([])

    await listFolders(account)

    expect(ImapFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: { user: 'test@gmail.com', pass: 'testpass' }
      })
    )
  })

  it('does not call ensureValidToken for password accounts', async () => {
    mockClient.list.mockResolvedValue([])
    vi.mocked(ensureValidToken).mockClear()

    await listFolders(account)

    expect(ensureValidToken).not.toHaveBeenCalled()
  })
})

// ============================================================================
// clearSentFolderCache
// ============================================================================

describe('clearSentFolderCache', () => {
  it('returns 0 when the cache is empty', () => {
    // Ensure cache is empty
    clearSentFolderCache()

    const count = clearSentFolderCache()
    expect(count).toBe(0)
  })

  it('returns the correct count and clears the cache after resolveSentFolder', async () => {
    // Clear initial state
    clearSentFolderCache()

    mockClient.list.mockResolvedValue([{ name: 'Sent', path: 'Sent', flags: new Set(['\\Sent']), delimiter: '/' }])

    // Populate cache
    await resolveSentFolder(account)
    await resolveSentFolder({ ...account, id: 'another-account' })

    const count = clearSentFolderCache()
    expect(count).toBe(2)

    // Verify it is empty
    expect(clearSentFolderCache()).toBe(0)
  })
})

describe('resolveSentFolder error paths', () => {
  it('deletes from cache on rejection (line 298-299 coverage)', async () => {
    // To trigger the catch block at 295-300, resolvePromise must reject.
    const badAccount = { ...account, id: 'bad-account', imap: null as any }

    // The first call should fail and trigger the catch block
    await expect(resolveSentFolder(badAccount)).rejects.toThrow()

    // Subsequent call with the same ID but fixed account should re-attempt
    const fixedAccount = { ...account, id: 'bad-account' }
    mockClient.list.mockResolvedValue([{ name: 'Sent', path: 'Sent', flags: new Set(['\\Sent']), delimiter: '/' }])

    const result = await resolveSentFolder(fixedAccount)
    expect(result).toBe('Sent')
    expect(mockClient.list).toHaveBeenCalled()
  })
})

describe('imap-client coverage edge cases', () => {
  it('covers attachments mapping in readEmail when attachments exist (line 450)', async () => {
    mockClient.fetchOne.mockResolvedValue({
      uid: 123,
      flags: new Set(['\\Seen']),
      source: Buffer.from('...')
    })

    mockSimpleParser.mockResolvedValue({
      subject: 'Test',
      from: 'me@test.com',
      to: 'you@test.com',
      date: new Date(),
      text: 'Body',
      attachments: [
        {
          filename: 'file.txt',
          contentType: 'text/plain',
          size: 10,
          contentId: 'cid1'
        }
      ]
    } as any)

    const result = await readEmail(account, 123, 'INBOX')
    expect(result.attachments).toHaveLength(1)
    expect(result.attachments[0].filename).toBe('file.txt')
  })

  it('covers attachment listing in error message in getAttachment (line 576)', async () => {
    mockClient.fetchOne.mockResolvedValue({ uid: 1, source: Buffer.from('...') })
    mockSimpleParser.mockResolvedValue({
      attachments: [{ filename: 'other.txt' }]
    } as any)

    try {
      await getAttachment(account, 1, 'INBOX', 'missing.txt')
      expect.fail('Should have thrown')
    } catch (e: any) {
      expect(e.message).toContain('not found')
      expect(e.suggestion).toContain('Available: other.txt')
    }
  })

  it('covers attachment listing with no attachments in error message in getAttachment (line 576)', async () => {
    mockClient.fetchOne.mockResolvedValue({ uid: 1, source: Buffer.from('...') })
    mockSimpleParser.mockResolvedValue({
      attachments: []
    } as any)

    try {
      await getAttachment(account, 1, 'INBOX', 'missing.txt')
      expect.fail('Should have thrown')
    } catch (e: any) {
      expect(e.message).toContain('not found')
      expect(e.suggestion).toContain('Available: none')
    }
  })
})
