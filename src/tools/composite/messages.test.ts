import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountConfig } from '../helpers/config.js'

// --- Mocks ---
vi.mock('../helpers/imap-client.js', () => ({
  searchEmails: vi.fn(),
  readEmail: vi.fn(),
  modifyFlags: vi.fn(),
  moveEmails: vi.fn(),
  trashEmails: vi.fn(),
  listFolders: vi.fn()
}))

import { listFolders, modifyFlags, moveEmails, readEmail, searchEmails, trashEmails } from '../helpers/imap-client.js'
import { messages } from './messages.js'

const mockSearchEmails = vi.mocked(searchEmails)
const mockReadEmail = vi.mocked(readEmail)
const mockModifyFlags = vi.mocked(modifyFlags)
const mockMoveEmails = vi.mocked(moveEmails)
const mockTrashEmails = vi.mocked(trashEmails)
const mockListFolders = vi.mocked(listFolders)

const accounts: AccountConfig[] = [
  {
    id: 'user1_gmail_com',
    email: 'user1@gmail.com',
    password: 'pass1',
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.gmail.com', port: 465, secure: true }
  },
  {
    id: 'user2_outlook_com',
    email: 'user2@outlook.com',
    password: 'pass2',
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
    smtp: { host: 'smtp.office365.com', port: 587, secure: false }
  }
]

beforeEach(() => {
  vi.clearAllMocks()
})

// ============================================================================
// search
// ============================================================================

describe('messages - search', () => {
  it('searches all accounts by default', async () => {
    mockSearchEmails.mockResolvedValue([])

    const result = await messages(accounts, { action: 'search' })

    expect(result.action).toBe('search')
    expect(result.query).toBe('UNSEEN')
    expect(result.folder).toBe('INBOX')
    expect(result.accounts_searched).toHaveLength(2)
    expect(mockSearchEmails).toHaveBeenCalledWith(accounts, 'UNSEEN', 'INBOX', 20)
  })

  it('filters by account when specified', async () => {
    mockSearchEmails.mockResolvedValue([])

    await messages(accounts, { action: 'search', account: 'user1@gmail.com' })

    expect(mockSearchEmails).toHaveBeenCalledWith(
      [accounts[0]],
      expect.any(String),
      expect.any(String),
      expect.any(Number)
    )
  })

  it('uses custom query, folder, and limit', async () => {
    mockSearchEmails.mockResolvedValue([])

    await messages(accounts, { action: 'search', query: 'FLAGGED', folder: 'Sent', limit: 5 })

    expect(mockSearchEmails).toHaveBeenCalledWith(accounts, 'FLAGGED', 'Sent', 5)
  })

  it('throws when account not found', async () => {
    await expect(messages(accounts, { action: 'search', account: 'nonexistent@test.com' })).rejects.toThrow(
      'Account not found'
    )
  })
})

// ============================================================================
// read
// ============================================================================

describe('messages - read', () => {
  it('reads email by UID', async () => {
    mockReadEmail.mockResolvedValue({
      account_id: 'user1_gmail_com',
      account_email: 'user1@gmail.com',
      uid: 42,
      subject: 'Test',
      from: 'sender@test.com',
      to: 'user1@gmail.com',
      date: '2025-01-01',
      flags: ['\\Seen'],
      body_text: 'Hello',
      attachments: []
    })

    const result = await messages(accounts, { action: 'read', uid: 42, account: 'user1@gmail.com' })

    expect(result.action).toBe('read')
    expect(result.uid).toBe(42)
    expect(result.subject).toBe('Test')
  })

  it('throws when uid is missing', async () => {
    await expect(messages(accounts, { action: 'read', account: 'user1@gmail.com' })).rejects.toThrow('uid is required')
  })

  it('throws when multiple accounts match', async () => {
    await expect(messages(accounts, { action: 'read', uid: 1, account: '.com' })).rejects.toThrow(
      'Multiple accounts matched'
    )
  })
})

// ============================================================================
// mark_read / mark_unread
// ============================================================================

describe('messages - mark_read', () => {
  it('adds \\Seen flag', async () => {
    mockModifyFlags.mockResolvedValue({ success: true, modified: 1 })

    const result = await messages(accounts, { action: 'mark_read', uid: 5, account: 'user1@gmail.com' })

    expect(result.action).toBe('mark_read')
    expect(mockModifyFlags).toHaveBeenCalledWith(accounts[0], [5], 'INBOX', ['\\Seen'], 'add')
  })

  it('supports batch uids', async () => {
    mockModifyFlags.mockResolvedValue({ success: true, modified: 3 })

    await messages(accounts, { action: 'mark_read', uids: [1, 2, 3], account: 'user1@gmail.com' })

    expect(mockModifyFlags).toHaveBeenCalledWith(accounts[0], [1, 2, 3], 'INBOX', ['\\Seen'], 'add')
  })

  it('throws when no uids provided', async () => {
    await expect(messages(accounts, { action: 'mark_read', account: 'user1@gmail.com' })).rejects.toThrow(
      'uid or uids required'
    )
  })
})

describe('messages - mark_unread', () => {
  it('removes \\Seen flag', async () => {
    mockModifyFlags.mockResolvedValue({ success: true, modified: 1 })

    await messages(accounts, { action: 'mark_unread', uid: 5, account: 'user1@gmail.com' })

    expect(mockModifyFlags).toHaveBeenCalledWith(accounts[0], [5], 'INBOX', ['\\Seen'], 'remove')
  })
})

// ============================================================================
// flag / unflag
// ============================================================================

describe('messages - flag', () => {
  it('adds \\Flagged flag', async () => {
    mockModifyFlags.mockResolvedValue({ success: true, modified: 1 })

    await messages(accounts, { action: 'flag', uid: 10, account: 'user1@gmail.com' })

    expect(mockModifyFlags).toHaveBeenCalledWith(accounts[0], [10], 'INBOX', ['\\Flagged'], 'add')
  })
})

describe('messages - unflag', () => {
  it('removes \\Flagged flag', async () => {
    mockModifyFlags.mockResolvedValue({ success: true, modified: 1 })

    await messages(accounts, { action: 'unflag', uid: 10, account: 'user1@gmail.com' })

    expect(mockModifyFlags).toHaveBeenCalledWith(accounts[0], [10], 'INBOX', ['\\Flagged'], 'remove')
  })
})

// ============================================================================
// move
// ============================================================================

describe('messages - move', () => {
  it('moves emails to destination folder', async () => {
    mockMoveEmails.mockResolvedValue({ success: true, moved: 2 })

    const result = await messages(accounts, {
      action: 'move',
      uids: [1, 2],
      destination: 'Archive',
      account: 'user1@gmail.com'
    })

    expect(result.action).toBe('move')
    expect(result.to_folder).toBe('Archive')
    expect(mockMoveEmails).toHaveBeenCalledWith(accounts[0], [1, 2], 'INBOX', 'Archive')
  })

  it('throws when destination is missing', async () => {
    await expect(messages(accounts, { action: 'move', uid: 1, account: 'user1@gmail.com' })).rejects.toThrow(
      'destination is required'
    )
  })
})

// ============================================================================
// archive
// ============================================================================

describe('messages - archive', () => {
  it('moves to Gmail archive folder', async () => {
    mockListFolders.mockResolvedValue([
      { name: 'All Mail', path: '[Gmail]/All Mail', flags: ['\\All'], delimiter: '/' }
    ])
    mockMoveEmails.mockResolvedValue({ success: true, moved: 1 })

    const result = await messages(accounts, { action: 'archive', uid: 1, account: 'user1@gmail.com' })

    expect(result.action).toBe('archive')
    expect(result.archive_folder).toBe('[Gmail]/All Mail')
  })

  it('falls back to default archive folder if listing fails', async () => {
    mockListFolders.mockRejectedValue(new Error('fail'))
    mockMoveEmails.mockResolvedValue({ success: true, moved: 1 })

    const result = await messages(accounts, { action: 'archive', uid: 1, account: 'user1@gmail.com' })

    expect(result.archive_folder).toBe('[Gmail]/All Mail')
  })

  it('uses Archive for Outlook accounts', async () => {
    mockListFolders.mockResolvedValue([{ name: 'Archive', path: 'Archive', flags: ['\\Archive'], delimiter: '/' }])
    mockMoveEmails.mockResolvedValue({ success: true, moved: 1 })

    const result = await messages(accounts, { action: 'archive', uid: 1, account: 'user2@outlook.com' })

    expect(result.archive_folder).toBe('Archive')
  })
})

// ============================================================================
// trash
// ============================================================================

describe('messages - trash', () => {
  it('trashes emails', async () => {
    mockTrashEmails.mockResolvedValue({ success: true, trashed: 1 })

    const result = await messages(accounts, { action: 'trash', uid: 99, account: 'user1@gmail.com' })

    expect(result.action).toBe('trash')
    expect(mockTrashEmails).toHaveBeenCalledWith(accounts[0], [99], 'INBOX')
  })
})

// ============================================================================
// unknown action
// ============================================================================

describe('messages - unknown action', () => {
  it('throws for unknown action', async () => {
    await expect(messages(accounts, { action: 'unknown_action' as any })).rejects.toThrow()
  })
})

// ============================================================================
// account resolution
// ============================================================================

describe('account resolution', () => {
  it('matches by partial email', async () => {
    mockSearchEmails.mockResolvedValue([])

    await messages(accounts, { action: 'search', account: 'gmail' })

    expect(mockSearchEmails).toHaveBeenCalledWith(
      [accounts[0]],
      expect.any(String),
      expect.any(String),
      expect.any(Number)
    )
  })

  it('matches by account id', async () => {
    mockSearchEmails.mockResolvedValue([])

    await messages(accounts, { action: 'search', account: 'user1_gmail_com' })

    expect(mockSearchEmails).toHaveBeenCalledWith(
      [accounts[0]],
      expect.any(String),
      expect.any(String),
      expect.any(Number)
    )
  })
})
