/**
 * IMAP Client Manager
 * Manages connections to multiple IMAP servers with connection pooling
 */

import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import type { AccountConfig } from './config.js'
import { EmailMCPError } from './errors.js'
import { fastExtractSnippet, htmlToCleanText } from './html-utils.js'
import { ensureValidToken } from './oauth2.js'

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
 * Create an ImapFlow client for the given account.
 * Uses XOAUTH2 for OAuth2 accounts, plain password otherwise.
 */
function createClient(account: AccountConfig): ImapFlow {
  const auth =
    account.authType === 'oauth2'
      ? { user: account.email, accessToken: account.oauth2!.accessToken }
      : { user: account.email, pass: account.password }

  return new ImapFlow({
    host: account.imap.host,
    port: account.imap.port,
    secure: account.imap.secure,
    auth,
    logger: false
  })
}

/**
 * Execute an operation with an IMAP connection (auto-connect/disconnect).
 * For OAuth2 accounts, refreshes the access token before connecting.
 */
async function withConnection<T>(account: AccountConfig, fn: (client: ImapFlow) => Promise<T>): Promise<T> {
  if (account.authType === 'oauth2') {
    await ensureValidToken(account)
  }

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

  // Detect wrong date format for SINCE (e.g. "SINCE 01/15/2026", "SINCE Jan 15")
  if (/^SINCE\s+/i.test(query) && !sinceMatch) {
    throw new EmailMCPError(
      'Invalid date format in SINCE query',
      'VALIDATION_ERROR',
      'Date must be YYYY-MM-DD format. Example: SINCE 2026-01-15'
    )
  }

  // From filter: FROM email@example.com (strip optional surrounding quotes)
  const fromMatch = query.match(/^FROM\s+(.+)$/i)
  if (fromMatch) return { from: fromMatch[1]!.trim().replace(/^["']|["']$/g, '') }

  // Subject filter: SUBJECT keyword (strip optional surrounding quotes)
  const subjectMatch = query.match(/^SUBJECT\s+(.+)$/i)
  if (subjectMatch) return { subject: subjectMatch[1]!.trim().replace(/^["']|["']$/g, '') }

  // Compound: UNREAD SINCE 2024-01-01
  const compoundUnreadSince = query.match(/^UNREAD\s+SINCE\s+(\d{4}-\d{2}-\d{2})$/i)
  if (compoundUnreadSince) return { seen: false, since: new Date(compoundUnreadSince[1]!) }

  // Detect wrong date format in compound UNREAD SINCE query
  if (/^UNREAD\s+SINCE\s+/i.test(query) && !compoundUnreadSince) {
    throw new EmailMCPError(
      'Invalid date format in UNREAD SINCE query',
      'VALIDATION_ERROR',
      'Date must be YYYY-MM-DD format. Example: UNREAD SINCE 2026-01-15'
    )
  }

  // Compound: UNREAD FROM x
  const compoundUnreadFrom = query.match(/^UNREAD\s+FROM\s+(.+)$/i)
  if (compoundUnreadFrom) return { seen: false, from: compoundUnreadFrom[1]!.trim().replace(/^["']|["']$/g, '') }

  // Default: treat as subject search
  return { subject: query }
}

/**
 * Extract a short snippet from email body
 */
async function extractSnippet(source: string | Buffer, maxLength = 200): Promise<string> {
  try {
    const parsed = await simpleParser(source)
    const text = parsed.text || (parsed.html ? fastExtractSnippet(parsed.html as string, maxLength) : '')
    if (!text) return ''
    // If we used fastExtractSnippet, it's already cleaned and truncated
    if (parsed.html && !parsed.text) return text
    const cleaned = text.replace(/\s+/g, ' ').trim()
    if (cleaned.length <= maxLength) return cleaned
    return `${cleaned.substring(0, maxLength)}...`
  } catch {
    return ''
  }
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
// Sent Folder
// ============================================================================

/** Cache for resolved sent folder paths per account */
const sentFolderCache = new Map<string, Promise<string>>()

/**
 * Resolve the Sent folder path for the given account.
 * Uses provider-specific defaults, then verifies via IMAP folder listing.
 * Results are cached per account.
 */
export async function resolveSentFolder(account: AccountConfig): Promise<string> {
  const cached = sentFolderCache.get(account.id)
  if (cached) return cached

  const resolvePromise = (async () => {
    // Provider-specific defaults
    let sentFolder = 'Sent'
    if (account.imap.host.includes('gmail')) {
      sentFolder = '[Gmail]/Sent Mail'
    } else if (account.imap.host.includes('office365') || account.imap.host.includes('outlook')) {
      sentFolder = 'Sent Items'
    }

    // Try to find the actual sent folder via IMAP flags
    try {
      const folders = await listFolders(account)
      const found = folders.find((f) => f.flags.some((flag) => flag === '\\Sent') || f.path === sentFolder)
      if (found) sentFolder = found.path
    } catch {
      // Use default if folder listing fails
    }

    return sentFolder
  })()

  sentFolderCache.set(account.id, resolvePromise)

  try {
    return await resolvePromise
  } catch (err) {
    sentFolderCache.delete(account.id)
    throw err
  }
}

/**
 * Append a raw RFC2822 message to an IMAP folder.
 * Used to save sent emails to the Sent folder.
 */
export async function appendToFolder(
  account: AccountConfig,
  folder: string,
  message: Buffer | string,
  flags?: string[]
): Promise<boolean> {
  return withConnection(account, async (client) => {
    const result = await client.append(folder, message, flags || ['\\Seen'], new Date())
    return result !== false
  })
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
  const criteria = buildSearchCriteria(query)

  const accountPromises = accounts.map(async (account) => {
    try {
      const emails = await withConnection(account, async (client) => {
        const lock = await client.getMailboxLock(folder)
        try {
          // Step 1: search to get UIDs (fast — server-side filtering)
          const allUids = await client.search(criteria, { uid: true })

          if (!allUids || allUids.length === 0) return []

          // Step 2: take the most recent `limit` UIDs (highest UIDs = most recent)
          const selectedUids = (allUids as number[]).slice(-limit)

          // Step 3: fetch only those specific UIDs
          const messages = await client.fetchAll(
            selectedUids,
            {
              uid: true,
              flags: true,
              envelope: true,
              bodyStructure: true,
              source: { start: 0, maxLength: 512 }
            },
            { uid: true }
          )

          // Process snippets in parallel to improve performance
          const summariesPromises = messages.map(async (msg) => {
            const snippet = msg.source ? await extractSnippet(msg.source) : ''

            return {
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
            }
          })

          return Promise.all(summariesPromises)
        } finally {
          lock.release()
        }
      })

      return emails
    } catch (error: any) {
      // Include error info but continue with other accounts
      return [
        {
          account_id: account.id,
          account_email: account.email,
          uid: 0,
          subject: `[ERROR] ${error.message}`,
          from: '',
          to: '',
          date: '',
          flags: [],
          snippet: `Failed to search ${account.email}: ${error.message}`
        }
      ]
    }
  })

  const resultsArrays = await Promise.all(accountPromises)
  return resultsArrays.flat()
}

/**
 * Read a single email by UID
 */
export async function readEmail(account: AccountConfig, uid: number, folder: string): Promise<EmailDetail> {
  const fetchResult = await withConnection(account, async (client) => {
    const lock = await client.getMailboxLock(folder)
    try {
      return await client.fetchOne(`${uid}`, { flags: true, source: true }, { uid: true })
    } finally {
      lock.release()
    }
  })

  if (!fetchResult || !fetchResult.source) {
    throw new EmailMCPError(`Email UID ${uid} not found in ${folder}`, 'NOT_FOUND', 'Check the UID and folder')
  }

  const parsed = await simpleParser(fetchResult.source!)
  const bodyText = parsed.text || (parsed.html ? htmlToCleanText(parsed.html as string) : '(Empty body)')

  return {
    account_id: account.id,
    account_email: account.email,
    uid: fetchResult.uid,
    message_id: parsed.messageId,
    in_reply_to: parsed.inReplyTo,
    references: Array.isArray(parsed.references) ? parsed.references.join(' ') : parsed.references,
    subject: parsed.subject || '(No subject)',
    from: formatAddress(parsed.from),
    to: formatAddress(parsed.to),
    cc: formatAddress(parsed.cc),
    bcc: formatAddress(parsed.bcc),
    date: parsed.date?.toISOString() || '',
    flags: Array.from(fetchResult.flags || []),
    body_text: bodyText,
    attachments: (parsed.attachments || []).map((att: any) => ({
      filename: att.filename || 'unnamed',
      content_type: att.contentType || 'application/octet-stream',
      size: att.size || 0,
      content_id: att.contentId
    }))
  }
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
      const lowerFilename = filename.toLowerCase()
      const attachment = parsed.attachments?.find((att) => att.filename?.toLowerCase() === lowerFilename)

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
