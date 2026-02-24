/**
 * IMAP Client Manager
 * Manages connections to multiple IMAP servers with connection pooling
 */

import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import type { AccountConfig } from './config.js'
import { EmailMCPError } from './errors.js'
import { htmlToCleanText } from './html-utils.js'

export interface EmailSummary {
  account_id: string
  account_email: string
  uid: number
  message_id?: string
  subject: string
  from: string
  to: string
  date: string
  flags: string[]
  snippet: string
}

export interface EmailDetail {
  account_id: string
  account_email: string
  uid: number
  message_id?: string
  in_reply_to?: string
  references?: string
  subject: string
  from: string
  to: string
  cc?: string
  bcc?: string
  date: string
  flags: string[]
  body_text: string
  attachments: AttachmentInfo[]
}

export interface AttachmentInfo {
  filename: string
  content_type: string
  size: number
  content_id?: string
}

export interface FolderInfo {
  name: string
  path: string
  flags: string[]
  delimiter: string
}

/**
 * Create an ImapFlow client for the given account
 */
function createClient(account: AccountConfig): ImapFlow {
  return new ImapFlow({
    host: account.imap.host,
    port: account.imap.port,
    secure: account.imap.secure,
    auth: {
      user: account.email,
      pass: account.password
    },
    logger: false
  })
}

/**
 * Execute an operation with an IMAP connection (auto-connect/disconnect)
 */
async function withConnection<T>(account: AccountConfig, fn: (client: ImapFlow) => Promise<T>): Promise<T> {
  const client = createClient(account)
  try {
    await client.connect()
    return await fn(client)
  } finally {
    try {
      await client.logout()
    } catch {
      // Ignore logout errors
    }
  }
}

/**
 * Build IMAP search criteria from query string
 */
function buildSearchCriteria(query: string): any {
  const upper = query.toUpperCase().trim()

  // Simple keyword shortcuts
  if (upper === 'UNREAD' || upper === 'UNSEEN') return { seen: false }
  if (upper === 'READ' || upper === 'SEEN') return { seen: true }
  if (upper === 'FLAGGED' || upper === 'STARRED') return { flagged: true }
  if (upper === 'UNFLAGGED' || upper === 'UNSTARRED') return { flagged: false }
  if (upper === 'ALL' || upper === '*') return {}

  // Date-based: SINCE YYYY-MM-DD
  const sinceMatch = query.match(/^SINCE\s+(\d{4}-\d{2}-\d{2})$/i)
  if (sinceMatch) return { since: new Date(sinceMatch[1]!) }

  // From filter: FROM email@example.com
  const fromMatch = query.match(/^FROM\s+(.+)$/i)
  if (fromMatch) return { from: fromMatch[1] }

  // Subject filter: SUBJECT keyword
  const subjectMatch = query.match(/^SUBJECT\s+(.+)$/i)
  if (subjectMatch) return { subject: subjectMatch[1] }

  // Compound: UNREAD SINCE 2024-01-01
  const compoundUnreadSince = query.match(/^UNREAD\s+SINCE\s+(\d{4}-\d{2}-\d{2})$/i)
  if (compoundUnreadSince) return { seen: false, since: new Date(compoundUnreadSince[1]!) }

  // Compound: UNREAD FROM x
  const compoundUnreadFrom = query.match(/^UNREAD\s+FROM\s+(.+)$/i)
  if (compoundUnreadFrom) return { seen: false, from: compoundUnreadFrom[1] }

  // Default: treat as subject search
  return { subject: query }
}

/**
 * Extract a short snippet from email body
 */
function extractSnippet(text: string, maxLength = 200): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= maxLength) return cleaned
  return `${cleaned.substring(0, maxLength)}...`
}

/**
 * Format email address from parsed address object
 */
function formatAddress(addr: any): string {
  if (!addr) return ''
  if (typeof addr === 'string') return addr
  if (addr.text) return addr.text
  if (Array.isArray(addr.value)) {
    return addr.value.map((a: any) => (a.name ? `${a.name} <${a.address}>` : a.address)).join(', ')
  }
  return ''
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Search emails across one or multiple accounts
 */
export async function searchEmails(
  accounts: AccountConfig[],
  query: string,
  folder: string,
  limit: number
): Promise<EmailSummary[]> {
  const results: EmailSummary[] = []
  const criteria = buildSearchCriteria(query)

  for (const account of accounts) {
    try {
      const emails = await withConnection(account, async (client) => {
        const lock = await client.getMailboxLock(folder)
        try {
          const summaries: EmailSummary[] = []
          let count = 0

          for await (const msg of client.fetch(criteria, {
            uid: true,
            flags: true,
            envelope: true,
            bodyStructure: true,
            source: { start: 0, maxLength: 500 }
          })) {
            if (count >= limit) break

            const snippet = msg.source ? extractSnippet(msg.source.toString('utf-8')) : ''

            summaries.push({
              account_id: account.id,
              account_email: account.email,
              uid: msg.uid,
              message_id: msg.envelope?.messageId,
              subject: msg.envelope?.subject || '(No subject)',
              from: msg.envelope?.from?.[0]
                ? `${msg.envelope.from[0].name || ''} <${msg.envelope.from[0].address || ''}>`.trim()
                : '',
              to: msg.envelope?.to?.map((a: any) => a.address).join(', ') || '',
              date: msg.envelope?.date?.toISOString() || '',
              flags: Array.from(msg.flags || []),
              snippet
            })
            count++
          }

          return summaries
        } finally {
          lock.release()
        }
      })

      results.push(...emails)
    } catch (error: any) {
      // Include error info but continue with other accounts
      results.push({
        account_id: account.id,
        account_email: account.email,
        uid: 0,
        subject: `[ERROR] ${error.message}`,
        from: '',
        to: '',
        date: '',
        flags: [],
        snippet: `Failed to search ${account.email}: ${error.message}`
      })
    }
  }

  return results
}

/**
 * Read a single email by UID
 */
export async function readEmail(account: AccountConfig, uid: number, folder: string): Promise<EmailDetail> {
  return withConnection(account, async (client) => {
    const lock = await client.getMailboxLock(folder)
    try {
      const fetchResult = await client.fetchOne(
        `${uid}`,
        {
          flags: true,
          source: true
        },
        { uid: true }
      )

      if (!fetchResult || !fetchResult.source) {
        throw new EmailMCPError(`Email UID ${uid} not found in ${folder}`, 'NOT_FOUND', 'Check the UID and folder')
      }

      const msg = fetchResult
      const parsed = await simpleParser(msg.source!)
      const bodyText = parsed.text || (parsed.html ? htmlToCleanText(parsed.html as string) : '(Empty body)')

      return {
        account_id: account.id,
        account_email: account.email,
        uid: msg.uid,
        message_id: parsed.messageId,
        in_reply_to: parsed.inReplyTo,
        references: Array.isArray(parsed.references) ? parsed.references.join(' ') : parsed.references,
        subject: parsed.subject || '(No subject)',
        from: formatAddress(parsed.from),
        to: formatAddress(parsed.to),
        cc: formatAddress(parsed.cc),
        bcc: formatAddress(parsed.bcc),
        date: parsed.date?.toISOString() || '',
        flags: Array.from(msg.flags || []),
        body_text: bodyText,
        attachments: (parsed.attachments || []).map((att: any) => ({
          filename: att.filename || 'unnamed',
          content_type: att.contentType || 'application/octet-stream',
          size: att.size || 0,
          content_id: att.contentId
        }))
      }
    } finally {
      lock.release()
    }
  })
}

/**
 * Modify email flags (mark read/unread, flag/unflag)
 */
export async function modifyFlags(
  account: AccountConfig,
  uids: number[],
  folder: string,
  flags: string[],
  action: 'add' | 'remove'
): Promise<{ success: boolean; modified: number }> {
  return withConnection(account, async (client) => {
    const lock = await client.getMailboxLock(folder)
    try {
      const uidStr = uids.join(',')
      if (action === 'add') {
        await client.messageFlagsAdd({ uid: uidStr }, flags)
      } else {
        await client.messageFlagsRemove({ uid: uidStr }, flags)
      }
      return { success: true, modified: uids.length }
    } finally {
      lock.release()
    }
  })
}

/**
 * Move emails to another folder
 */
export async function moveEmails(
  account: AccountConfig,
  uids: number[],
  fromFolder: string,
  toFolder: string
): Promise<{ success: boolean; moved: number }> {
  return withConnection(account, async (client) => {
    const lock = await client.getMailboxLock(fromFolder)
    try {
      const uidStr = uids.join(',')
      await client.messageMove({ uid: uidStr }, toFolder)
      return { success: true, moved: uids.length }
    } finally {
      lock.release()
    }
  })
}

/**
 * Delete (trash) emails
 */
export async function trashEmails(
  account: AccountConfig,
  uids: number[],
  folder: string
): Promise<{ success: boolean; trashed: number }> {
  return withConnection(account, async (client) => {
    const lock = await client.getMailboxLock(folder)
    try {
      const uidStr = uids.join(',')
      await client.messageDelete({ uid: uidStr })
      return { success: true, trashed: uids.length }
    } finally {
      lock.release()
    }
  })
}

/**
 * List mailbox folders
 */
export async function listFolders(account: AccountConfig): Promise<FolderInfo[]> {
  return withConnection(account, async (client) => {
    const mailboxes = await client.list()
    return mailboxes.map((mb: any) => ({
      name: mb.name,
      path: mb.path,
      flags: Array.from(mb.flags || []),
      delimiter: mb.delimiter || '/'
    }))
  })
}

/**
 * Get attachment content by filename
 */
export async function getAttachment(
  account: AccountConfig,
  uid: number,
  folder: string,
  filename: string
): Promise<{ filename: string; content_type: string; size: number; content_base64: string }> {
  return withConnection(account, async (client) => {
    const lock = await client.getMailboxLock(folder)
    try {
      const fetchResult = await client.fetchOne(`${uid}`, { source: true }, { uid: true })
      if (!fetchResult || !fetchResult.source) {
        throw new EmailMCPError(`Email UID ${uid} not found`, 'NOT_FOUND', 'Check the UID and folder')
      }

      const parsed = await simpleParser(fetchResult.source)
      const attachment = parsed.attachments?.find((att) => att.filename?.toLowerCase() === filename.toLowerCase())

      if (!attachment) {
        throw new EmailMCPError(
          `Attachment "${filename}" not found`,
          'ATTACHMENT_NOT_FOUND',
          `Available: ${parsed.attachments?.map((a) => a.filename).join(', ') || 'none'}`
        )
      }

      return {
        filename: attachment.filename || 'unnamed',
        content_type: attachment.contentType || 'application/octet-stream',
        size: attachment.size || 0,
        content_base64: attachment.content.toString('base64')
      }
    } finally {
      lock.release()
    }
  })
}
