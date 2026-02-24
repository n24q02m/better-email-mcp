/**
 * Send Mega Tool
 * Send new emails, reply, and forward via SMTP
 */

import type { AccountConfig } from '../helpers/config.js'
import { EmailMCPError, withErrorHandling } from '../helpers/errors.js'
import { readEmail } from '../helpers/imap-client.js'
import { forwardEmail, replyToEmail, sendNewEmail } from '../helpers/smtp-client.js'

export interface SendInput {
  action: 'new' | 'reply' | 'forward'

  // Required for all
  account: string
  to: string
  subject: string
  body: string

  // Optional
  cc?: string
  bcc?: string

  // Reply/Forward - reference to original email
  uid?: number
  folder?: string
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
 * Unified send tool - handles all outbound email operations
 */
export async function send(accounts: AccountConfig[], input: SendInput): Promise<any> {
  return withErrorHandling(async () => {
    if (!input.account) {
      throw new EmailMCPError(
        'account is required for send operations',
        'VALIDATION_ERROR',
        'Provide the sender account email address'
      )
    }

    if (!input.to) {
      throw new EmailMCPError('to is required', 'VALIDATION_ERROR', 'Provide recipient email address')
    }

    if (!input.body) {
      throw new EmailMCPError('body is required', 'VALIDATION_ERROR', 'Provide the email body text')
    }

    switch (input.action) {
      case 'new':
        return await handleNew(accounts, input)

      case 'reply':
        return await handleReply(accounts, input)

      case 'forward':
        return await handleForward(accounts, input)

      default:
        throw new EmailMCPError(
          `Unknown action: ${input.action}`,
          'VALIDATION_ERROR',
          'Supported actions: new, reply, forward'
        )
    }
  })()
}

/**
 * Send a new email
 */
async function handleNew(accounts: AccountConfig[], input: SendInput): Promise<any> {
  if (!input.subject) {
    throw new EmailMCPError('subject is required for new email', 'VALIDATION_ERROR', 'Provide the email subject')
  }

  const account = resolveSingleAccount(accounts, input.account)

  const result = await sendNewEmail(account, {
    to: input.to,
    subject: input.subject,
    body: input.body,
    cc: input.cc,
    bcc: input.bcc
  })

  return {
    action: 'new',
    from: account.email,
    to: input.to,
    subject: input.subject,
    ...result
  }
}

/**
 * Reply to an email (maintains thread headers)
 */
async function handleReply(accounts: AccountConfig[], input: SendInput): Promise<any> {
  if (!input.uid) {
    throw new EmailMCPError(
      'uid is required for reply action',
      'VALIDATION_ERROR',
      'Provide the UID of the email to reply to (from search/read)'
    )
  }

  const account = resolveSingleAccount(accounts, input.account)
  const folder = input.folder || 'INBOX'

  // Read original email to get threading headers
  const original = await readEmail(account, input.uid, folder)

  const result = await replyToEmail(account, {
    to: input.to,
    subject: input.subject || original.subject,
    body: input.body,
    cc: input.cc,
    bcc: input.bcc,
    in_reply_to: original.message_id,
    references: original.references || original.message_id
  })

  return {
    action: 'reply',
    from: account.email,
    to: input.to,
    subject: input.subject || `Re: ${original.subject}`,
    in_reply_to: original.message_id,
    ...result
  }
}

/**
 * Forward an email
 */
async function handleForward(accounts: AccountConfig[], input: SendInput): Promise<any> {
  if (!input.uid) {
    throw new EmailMCPError(
      'uid is required for forward action',
      'VALIDATION_ERROR',
      'Provide the UID of the email to forward (from search/read)'
    )
  }

  const account = resolveSingleAccount(accounts, input.account)
  const folder = input.folder || 'INBOX'

  // Read original email to include in forward
  const original = await readEmail(account, input.uid, folder)

  const result = await forwardEmail(account, {
    to: input.to,
    subject: input.subject || original.subject,
    body: input.body,
    cc: input.cc,
    bcc: input.bcc,
    original_body: original.body_text
  })

  return {
    action: 'forward',
    from: account.email,
    to: input.to,
    subject: input.subject || `Fwd: ${original.subject}`,
    ...result
  }
}
