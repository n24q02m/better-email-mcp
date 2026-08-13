/**
 * Folders Mega Tool
 * List mailbox folders across email accounts
 */

import type { AccountConfig } from '../helpers/config.js'
import { resolveAccounts, resolveSingleAccount } from '../helpers/config.js'
import { createUnknownActionError, EmailMCPError, withErrorHandling } from '../helpers/errors.js'
import { getFolderStatus, listFolders } from '../helpers/imap-client.js'

export interface FoldersInput {
  action: 'list' | 'status'

  // Target account (optional - defaults to all)
  account?: string

  // Exact mailbox path (required for status)
  folder?: string
}

/**
 * Unified folders tool - handles folder listing
 */
export async function folders(accounts: AccountConfig[], input: FoldersInput): Promise<any> {
  return withErrorHandling(async () => {
    switch (input.action) {
      case 'list':
        return await handleList(accounts, input)

      case 'status':
        return await handleStatus(accounts, input)

      default:
        throw createUnknownActionError(input.action, 'list, status')
    }
  })()
}

/**
 * Read STATUS metadata for one exact account and mailbox.
 */
async function handleStatus(accounts: AccountConfig[], input: FoldersInput): Promise<any> {
  if (!input.account?.trim()) {
    throw new EmailMCPError(
      'account is required for status action',
      'VALIDATION_ERROR',
      'Provide exactly one configured account email or account ID'
    )
  }
  if (!input.folder?.trim()) {
    throw new EmailMCPError(
      'folder is required for status action',
      'VALIDATION_ERROR',
      'Provide one exact mailbox path, such as INBOX'
    )
  }

  const account = resolveSingleAccount(accounts, input.account)
  const status = await getFolderStatus(account, input.folder)

  return {
    action: 'status',
    account_id: account.id,
    account_email: account.email,
    folder: input.folder,
    ...status
  }
}

/**
 * List folders across accounts
 */
async function handleList(accounts: AccountConfig[], input: FoldersInput): Promise<any> {
  const targetAccounts = resolveAccounts(accounts, input.account)

  const accountPromises = targetAccounts.map(async (account) => {
    try {
      const folderList = await listFolders(account)
      return {
        account_id: account.id,
        account_email: account.email,
        folders: folderList
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        account_id: account.id,
        account_email: account.email,
        error: errorMessage,
        folders: []
      }
    }
  })

  const results = await Promise.all(accountPromises)

  return {
    action: 'list',
    total_accounts: results.length,
    accounts: results
  }
}
