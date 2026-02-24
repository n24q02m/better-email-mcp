import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountConfig } from '../helpers/config.js'

// --- Mocks ---
vi.mock('../helpers/imap-client.js', () => ({
  listFolders: vi.fn()
}))

import { listFolders } from '../helpers/imap-client.js'
import { folders } from './folders.js'

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

describe('folders - list', () => {
  it('lists folders for all accounts', async () => {
    mockListFolders.mockResolvedValue([{ name: 'INBOX', path: 'INBOX', flags: [], delimiter: '/' }])

    const result = await folders(accounts, { action: 'list' })

    expect(result.action).toBe('list')
    expect(result.total_accounts).toBe(2)
    expect(result.accounts).toHaveLength(2)
    expect(mockListFolders).toHaveBeenCalledTimes(2)
  })

  it('filters by account', async () => {
    mockListFolders.mockResolvedValue([{ name: 'INBOX', path: 'INBOX', flags: [], delimiter: '/' }])

    const result = await folders(accounts, { action: 'list', account: 'user1@gmail.com' })

    expect(result.total_accounts).toBe(1)
    expect(result.accounts[0].account_email).toBe('user1@gmail.com')
    expect(mockListFolders).toHaveBeenCalledTimes(1)
  })

  it('includes error when one account fails', async () => {
    mockListFolders
      .mockResolvedValueOnce([{ name: 'INBOX', path: 'INBOX', flags: [], delimiter: '/' }])
      .mockRejectedValueOnce(new Error('Auth failed'))

    const result = await folders(accounts, { action: 'list' })

    expect(result.total_accounts).toBe(2)
    expect(result.accounts[0].folders).toHaveLength(1)
    expect(result.accounts[1].error).toBe('Auth failed')
    expect(result.accounts[1].folders).toHaveLength(0)
  })

  it('throws when account not found', async () => {
    await expect(folders(accounts, { action: 'list', account: 'nonexistent@test.com' })).rejects.toThrow(
      'Account not found'
    )
  })

  it('throws for unknown action', async () => {
    await expect(folders(accounts, { action: 'unknown' as any })).rejects.toThrow()
  })
})
