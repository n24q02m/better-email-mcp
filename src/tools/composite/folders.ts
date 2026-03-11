/**
 * Folders Mega Tool
 * List mailbox folders across email accounts
 */

import type { AccountConfig } from '../helpers/config.js'
import { resolveAccounts } from '../helpers/config.js'
import { createUnknownActionError, withErrorHandling } from '../helpers/errors.js'
import { listFolders } from '../helpers/imap-client.js'

export interface FoldersInput {
  action: 'list'

  // Target account (optional - defaults to all)
  account?: string
}

/**
 * Unified folders tool - handles folder listing
 */
export async function folders(accounts: AccountConfig[], input: FoldersInput): Promise<any> {
  return withErrorHandling(async () => {
    switch (input.action) {
      case 'list':
        return await handleList(accounts, input)

      default:
        throw createUnknownActionError(input.action, 'list')
    }
  })()
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
    } catch (error: any) {
      return {
        account_id: account.id,
        account_email: account.email,
        error: error.message,
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
