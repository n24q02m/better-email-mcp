/**
 * Send Mega Tool
 * Send new emails, reply, and forward via SMTP
 */

import type { AccountConfig } from '../helpers/config.js'
import { resolveSingleAccount } from '../helpers/config.js'
import { EmailMCPError, withErrorHandling } from '../helpers/errors.js'
import { appendToFolder, readEmail, resolveSentFolder } from '../helpers/imap-client.js'
import type { SendResult } from '../helpers/smtp-client.js'
import { forwardEmail, replyToEmail, sendNewEmail } from '../helpers/smtp-client.js'

/**
 * Providers whose SMTP servers auto-save sent messages to the Sent folder.
 * IMAP APPEND on these would create duplicates.
 * - Gmail: smtp.gmail.com
 * - Yahoo: smtp.mail.yahoo.com
 * - iCloud: smtp.mail.me.com
 */
function autoSavesToSent(account: AccountConfig): boolean {
  const host = account.smtp.host
  return host.includes('gmail') || host.includes('yahoo') || host.includes('mail.me')
}

/**
 * Best-effort save to Sent folder via IMAP APPEND.
 * Skips providers that auto-save (Gmail, Yahoo, iCloud).
 * Failures are silent — sending already succeeded.
 */
async function saveToSent(account: AccountConfig, result: SendResult): Promise<boolean> {
  if (!result.raw || autoSavesToSent(account)) return false
  try {
    const sentFolder = await resolveSentFolder(account)
    return await appendToFolder(account, sentFolder, result.raw, ['\\Seen'])
  } catch {
    return false
  }
}

export interface SendInput {
  action: 'new' | 'reply' | 'forward'

  // Required for all
  account: string
  body: string

  // Required for new/forward; optional for reply (auto-derived from original sender)
  to?: string

  // Required for new; optional for reply/forward (auto-derived from original subject)
  subject?: string

  // Optional
  cc?: string
  bcc?: string

  // Reply/Forward - reference to original email
  uid?: number
  folder?: string
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
  if (!input.to) {
    throw new EmailMCPError('to is required for new email', 'VALIDATION_ERROR', 'Provide the recipient email address')
  }

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

  const saved_to_sent = await saveToSent(account, result)

  return {
    action: 'new',
    from: account.email,
    to: input.to,
    subject: input.subject,
    success: result.success,
    message_id: result.message_id,
    saved_to_sent
  }
}

/**
 * Reply to an email (maintains thread headers)
 * `to` is optional — defaults to the original sender's address
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

  // Read original email to get threading headers + auto-derive `to`
  const original = await readEmail(account, input.uid, folder)

  // Auto-derive `to` from original sender if not provided
  const replyTo = input.to || original.from

  if (!replyTo) {
    throw new EmailMCPError(
      'Could not determine reply-to address',
      'VALIDATION_ERROR',
      'Provide the `to` field explicitly, or ensure the original email has a From address'
    )
  }

  const result = await replyToEmail(account, {
    to: replyTo,
    subject: input.subject || original.subject,
    body: input.body,
    cc: input.cc,
    bcc: input.bcc,
    in_reply_to: original.message_id,
    references: original.references || original.message_id
  })

  const saved_to_sent = await saveToSent(account, result)

  return {
    action: 'reply',
    from: account.email,
    to: replyTo,
    subject: input.subject || `Re: ${original.subject}`,
    in_reply_to: original.message_id,
    success: result.success,
    message_id: result.message_id,
    saved_to_sent
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

  if (!input.to) {
    throw new EmailMCPError(
      'to is required for forward action',
      'VALIDATION_ERROR',
      'Provide the recipient email address'
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

  const saved_to_sent = await saveToSent(account, result)

  return {
    action: 'forward',
    from: account.email,
    to: input.to,
    subject: input.subject || `Fwd: ${original.subject}`,
    success: result.success,
    message_id: result.message_id,
    saved_to_sent
  }
}
