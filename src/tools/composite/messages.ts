/**
 * Messages Mega Tool
 * All email message operations in one unified interface
 */

import type { AccountConfig } from '../helpers/config.js'
import { EmailMCPError, withErrorHandling } from '../helpers/errors.js'
import { listFolders, modifyFlags, moveEmails, readEmail, searchEmails, trashEmails } from '../helpers/imap-client.js'

// Simple in-memory cache for archive folder paths to avoid repeated IMAP calls
const archiveFolderCache = new Map<string, string>()

export interface MessagesInput {
  action: 'search' | 'read' | 'mark_read' | 'mark_unread' | 'flag' | 'unflag' | 'move' | 'archive' | 'trash'

  // Target account (optional - defaults to all for search, first for others)
  account?: string

  // Search params
  query?: string
  folder?: string
  limit?: number

  // Read/modify params
  uid?: number
  uids?: number[]

  // Move params
  destination?: string
}

/**
 * Resolve target accounts from input
 */
function resolveAccounts(accounts: AccountConfig[], accountFilter?: string): AccountConfig[] {
  if (!accountFilter) return accounts

  const lower = accountFilter.toLowerCase()
  const matched = accounts.filter(
    (a) => a.email.toLowerCase() === lower || a.id === lower || a.email.toLowerCase().includes(lower)
  )

  if (matched.length === 0) {
    throw new EmailMCPError(
      `Account not found: ${accountFilter}`,
      'ACCOUNT_NOT_FOUND',
      `Available accounts: ${accounts.map((a) => a.email).join(', ')}`
    )
  }

  return matched
}

/**
 * Resolve a single account (for operations that require exactly one)
 */
function resolveSingleAccount(accounts: AccountConfig[], accountFilter?: string): AccountConfig {
  const resolved = resolveAccounts(accounts, accountFilter)
  if (resolved.length > 1) {
    throw new EmailMCPError(
      'Multiple accounts matched. Specify the exact account email.',
      'AMBIGUOUS_ACCOUNT',
      `Matched: ${resolved.map((a) => a.email).join(', ')}`
    )
  }
  return resolved[0]!
}

/**
 * Unified messages tool - handles all message operations
 */
export async function messages(accounts: AccountConfig[], input: MessagesInput): Promise<any> {
  return withErrorHandling(async () => {
    switch (input.action) {
      case 'search':
        return await handleSearch(accounts, input)

      case 'read':
        return await handleRead(accounts, input)

      case 'mark_read':
        return await handleMarkRead(accounts, input)

      case 'mark_unread':
        return await handleMarkUnread(accounts, input)

      case 'flag':
        return await handleFlag(accounts, input)

      case 'unflag':
        return await handleUnflag(accounts, input)

      case 'move':
        return await handleMove(accounts, input)

      case 'archive':
        return await handleArchive(accounts, input)

      case 'trash':
        return await handleTrash(accounts, input)

      default:
        throw new EmailMCPError(
          `Unknown action: ${input.action}`,
          'VALIDATION_ERROR',
          'Supported actions: search, read, mark_read, mark_unread, flag, unflag, move, archive, trash'
        )
    }
  })()
}

/**
 * Search emails across accounts
 */
async function handleSearch(accounts: AccountConfig[], input: MessagesInput): Promise<any> {
  const targetAccounts = resolveAccounts(accounts, input.account)
  const query = input.query || 'UNSEEN'
  const folder = input.folder || 'INBOX'
  const limit = input.limit || 20

  const results = await searchEmails(targetAccounts, query, folder, limit)

  return {
    action: 'search',
    query,
    folder,
    total: results.length,
    accounts_searched: targetAccounts.map((a) => a.email),
    messages: results
  }
}

/**
 * Read a single email by UID
 */
async function handleRead(accounts: AccountConfig[], input: MessagesInput): Promise<any> {
  if (!input.uid) {
    throw new EmailMCPError('uid is required for read action', 'VALIDATION_ERROR', 'Provide the email UID from search')
  }

  const account = resolveSingleAccount(accounts, input.account)
  const folder = input.folder || 'INBOX'

  const email = await readEmail(account, input.uid, folder)

  return {
    action: 'read',
    ...email
  }
}

/**
 * Mark emails as read
 */
async function handleMarkRead(accounts: AccountConfig[], input: MessagesInput): Promise<any> {
  const uids = input.uids || (input.uid ? [input.uid] : [])
  if (uids.length === 0) {
    throw new EmailMCPError('uid or uids required', 'VALIDATION_ERROR', 'Provide at least one email UID')
  }

  const account = resolveSingleAccount(accounts, input.account)
  const folder = input.folder || 'INBOX'

  const result = await modifyFlags(account, uids, folder, ['\\Seen'], 'add')

  return {
    action: 'mark_read',
    account: account.email,
    folder,
    ...result
  }
}

/**
 * Mark emails as unread
 */
async function handleMarkUnread(accounts: AccountConfig[], input: MessagesInput): Promise<any> {
  const uids = input.uids || (input.uid ? [input.uid] : [])
  if (uids.length === 0) {
    throw new EmailMCPError('uid or uids required', 'VALIDATION_ERROR', 'Provide at least one email UID')
  }

  const account = resolveSingleAccount(accounts, input.account)
  const folder = input.folder || 'INBOX'

  const result = await modifyFlags(account, uids, folder, ['\\Seen'], 'remove')

  return {
    action: 'mark_unread',
    account: account.email,
    folder,
    ...result
  }
}

/**
 * Flag (star) emails
 */
async function handleFlag(accounts: AccountConfig[], input: MessagesInput): Promise<any> {
  const uids = input.uids || (input.uid ? [input.uid] : [])
  if (uids.length === 0) {
    throw new EmailMCPError('uid or uids required', 'VALIDATION_ERROR', 'Provide at least one email UID')
  }

  const account = resolveSingleAccount(accounts, input.account)
  const folder = input.folder || 'INBOX'

  const result = await modifyFlags(account, uids, folder, ['\\Flagged'], 'add')

  return {
    action: 'flag',
    account: account.email,
    folder,
    ...result
  }
}

/**
 * Unflag (unstar) emails
 */
async function handleUnflag(accounts: AccountConfig[], input: MessagesInput): Promise<any> {
  const uids = input.uids || (input.uid ? [input.uid] : [])
  if (uids.length === 0) {
    throw new EmailMCPError('uid or uids required', 'VALIDATION_ERROR', 'Provide at least one email UID')
  }

  const account = resolveSingleAccount(accounts, input.account)
  const folder = input.folder || 'INBOX'

  const result = await modifyFlags(account, uids, folder, ['\\Flagged'], 'remove')

  return {
    action: 'unflag',
    account: account.email,
    folder,
    ...result
  }
}

/**
 * Move emails to another folder
 */
async function handleMove(accounts: AccountConfig[], input: MessagesInput): Promise<any> {
  const uids = input.uids || (input.uid ? [input.uid] : [])
  if (uids.length === 0) {
    throw new EmailMCPError('uid or uids required', 'VALIDATION_ERROR', 'Provide at least one email UID')
  }

  if (!input.destination) {
    throw new EmailMCPError(
      'destination is required for move action',
      'VALIDATION_ERROR',
      'Provide the target folder name. Use folders tool to list available folders.'
    )
  }

  const account = resolveSingleAccount(accounts, input.account)
  const folder = input.folder || 'INBOX'

  const result = await moveEmails(account, uids, folder, input.destination)

  return {
    action: 'move',
    account: account.email,
    from_folder: folder,
    to_folder: input.destination,
    ...result
  }
}

/**
 * Archive emails (move to archive folder)
 */
async function handleArchive(accounts: AccountConfig[], input: MessagesInput): Promise<any> {
  const uids = input.uids || (input.uid ? [input.uid] : [])
  if (uids.length === 0) {
    throw new EmailMCPError('uid or uids required', 'VALIDATION_ERROR', 'Provide at least one email UID')
  }

  const account = resolveSingleAccount(accounts, input.account)
  const folder = input.folder || 'INBOX'

  // Check cache first
  let archiveFolder = archiveFolderCache.get(account.id)

  if (!archiveFolder) {
    // Detect archive folder based on provider
    archiveFolder = '[Gmail]/All Mail'
    if (account.imap.host.includes('office365') || account.imap.host.includes('outlook')) {
      archiveFolder = 'Archive'
    } else if (account.imap.host.includes('yahoo')) {
      archiveFolder = 'Archive'
    }

    // Try to find actual archive folder
    try {
      const folders = await listFolders(account)
      const found = folders.find(
        (f) =>
          f.path.toLowerCase().includes('archive') ||
          f.path.toLowerCase().includes('all mail') ||
          f.flags.some((flag) => flag.toLowerCase().includes('archive') || flag.toLowerCase().includes('all'))
      )
      if (found) {
        archiveFolder = found.path
      }
    } catch {
      // Use default if folder listing fails
    }

    // Cache the result
    archiveFolderCache.set(account.id, archiveFolder)
  }

  const result = await moveEmails(account, uids, folder, archiveFolder)

  return {
    action: 'archive',
    account: account.email,
    from_folder: folder,
    archive_folder: archiveFolder,
    ...result
  }
}

/**
 * Trash emails
 */
async function handleTrash(accounts: AccountConfig[], input: MessagesInput): Promise<any> {
  const uids = input.uids || (input.uid ? [input.uid] : [])
  if (uids.length === 0) {
    throw new EmailMCPError('uid or uids required', 'VALIDATION_ERROR', 'Provide at least one email UID')
  }

  const account = resolveSingleAccount(accounts, input.account)
  const folder = input.folder || 'INBOX'

  const result = await trashEmails(account, uids, folder)

  return {
    action: 'trash',
    account: account.email,
    folder,
    ...result
  }
}
