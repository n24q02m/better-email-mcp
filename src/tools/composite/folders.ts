/**
 * Folders Mega Tool
 * List mailbox folders across email accounts
 */

import type { AccountConfig } from '../helpers/config.js'
import { EmailMCPError, withErrorHandling } from '../helpers/errors.js'
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
        throw new EmailMCPError(`Unknown action: ${input.action}`, 'VALIDATION_ERROR', 'Supported actions: list')
    }
  })()
}

/**
 * List folders across accounts
 */
async function handleList(accounts: AccountConfig[], input: FoldersInput): Promise<any> {
  let targetAccounts = accounts

  if (input.account) {
    const lower = input.account.toLowerCase()
    targetAccounts = accounts.filter(
      (a) => a.email.toLowerCase() === lower || a.id === lower || a.email.toLowerCase().includes(lower)
    )

    if (targetAccounts.length === 0) {
      throw new EmailMCPError(
        `Account not found: ${input.account}`,
        'ACCOUNT_NOT_FOUND',
        `Available accounts: ${accounts.map((a) => a.email).join(', ')}`
      )
    }
  }

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
