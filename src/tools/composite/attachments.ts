/**
 * Attachments Mega Tool
 * List and download email attachments
 */

import type { AccountConfig } from '../helpers/config.js'
import { EmailMCPError, withErrorHandling } from '../helpers/errors.js'
import { getAttachment, readEmail } from '../helpers/imap-client.js'

export interface AttachmentsInput {
  action: 'list' | 'download'

  // Required
  account: string
  uid: number

  // Optional
  folder?: string
  filename?: string
}

/**
 * Resolve a single account by filter
 */
function resolveSingleAccount(accounts: AccountConfig[], accountFilter: string): AccountConfig {
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

  if (matched.length > 1) {
    throw new EmailMCPError(
      'Multiple accounts matched. Specify the exact account email.',
      'AMBIGUOUS_ACCOUNT',
      `Matched: ${matched.map((a) => a.email).join(', ')}`
    )
  }

  return matched[0]!
}

/**
 * Unified attachments tool - handles attachment operations
 */
export async function attachments(accounts: AccountConfig[], input: AttachmentsInput): Promise<any> {
  return withErrorHandling(async () => {
    if (!input.account) {
      throw new EmailMCPError(
        'account is required for attachment operations',
        'VALIDATION_ERROR',
        'Provide the account email address'
      )
    }

    if (!input.uid) {
      throw new EmailMCPError(
        'uid is required for attachment operations',
        'VALIDATION_ERROR',
        'Provide the email UID from search/read'
      )
    }

    switch (input.action) {
      case 'list':
        return await handleList(accounts, input)

      case 'download':
        return await handleDownload(accounts, input)

      default:
        throw new EmailMCPError(
          `Unknown action: ${input.action}`,
          'VALIDATION_ERROR',
          'Supported actions: list, download'
        )
    }
  })()
}

/**
 * List attachments for an email
 */
async function handleList(accounts: AccountConfig[], input: AttachmentsInput): Promise<any> {
  const account = resolveSingleAccount(accounts, input.account)
  const folder = input.folder || 'INBOX'

  const email = await readEmail(account, input.uid, folder)

  return {
    action: 'list',
    account: account.email,
    uid: input.uid,
    folder,
    subject: email.subject,
    total: email.attachments.length,
    attachments: email.attachments
  }
}

/**
 * Download a specific attachment (returns base64)
 */
async function handleDownload(accounts: AccountConfig[], input: AttachmentsInput): Promise<any> {
  if (!input.filename) {
    throw new EmailMCPError(
      'filename is required for download action',
      'VALIDATION_ERROR',
      'Use attachments list action first to see available filenames'
    )
  }

  const account = resolveSingleAccount(accounts, input.account)
  const folder = input.folder || 'INBOX'

  const attachment = await getAttachment(account, input.uid, folder, input.filename)

  return {
    action: 'download',
    account: account.email,
    uid: input.uid,
    folder,
    ...attachment
  }
}
