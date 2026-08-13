/**
 * IMAP Client Manager
 * Manages connections to multiple IMAP servers with connection pooling
 */

import { type FetchMessageObject, ImapFlow, type ListResponse, type SearchObject } from 'imapflow'
import {
  type AddressObject,
  type Attachment,
  type EmailAddress,
  type SimpleParserOptions,
  simpleParser
} from 'mailparser'
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

export interface UnavailableAccount {
  account_id: string
  account_email: string
  code: string
  reason: string
}

export type SearchEmailResults = EmailSummary[] & {
  unavailableAccounts?: UnavailableAccount[]
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

export interface FolderStatusInfo {
  messages: number
  unseen: number
  uid_next: number
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
    await ensureValidToken(account, { allowInteractive: false })
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
 * Build IMAP search criteria from a query string.
 *
 * Supports arbitrary combinations of clauses in any order:
 *   FROM x, TO x, SUBJECT x, SINCE YYYY-MM-DD, BEFORE YYYY-MM-DD,
 *   UNREAD/UNSEEN, READ/SEEN, FLAGGED/STARRED, UNFLAGGED/UNSTARRED, ALL/*
 *
 * Examples:
 *   "FROM user@test.com SINCE 2026-01-01"  -> { from: 'user@test.com', since: Date }
 *   "UNREAD FROM boss SINCE 2026-03-01"    -> { seen: false, from: 'boss', since: Date }
 *   "meeting notes"                         -> { subject: 'meeting notes' }
 */
// Pre-compile static RegExp patterns as module-level constants so
// buildSearchCriteria does not recompile them per call.
const FLAG_MATCHERS: ReadonlyArray<{ pattern: RegExp; key: keyof SearchObject; value: boolean }> = [
  { pattern: /\bUNFLAGGED\b/gi, key: 'flagged', value: false },
  { pattern: /\bUNSTARRED\b/gi, key: 'flagged', value: false },
  { pattern: /\bUNREAD\b/gi, key: 'seen', value: false },
  { pattern: /\bUNSEEN\b/gi, key: 'seen', value: false },
  { pattern: /\bFLAGGED\b/gi, key: 'flagged', value: true },
  { pattern: /\bSTARRED\b/gi, key: 'flagged', value: true },
  { pattern: /\bREAD\b/gi, key: 'seen', value: true },
  { pattern: /\bSEEN\b/gi, key: 'seen', value: true }
]

const DATE_MATCHERS = {
  SINCE: { valid: /\bSINCE\s+(\d{4}-\d{2}-\d{2})\b/i, invalid: /\bSINCE\s+\S/gi },
  BEFORE: { valid: /\bBEFORE\s+(\d{4}-\d{2}-\d{2})\b/i, invalid: /\bBEFORE\s+\S/gi }
} as const

const KV_MATCHERS = {
  FROM: /\bFROM\s+("[^"]+"|'[^']+'|\S+)/i,
  TO: /\bTO\s+("[^"]+"|'[^']+'|\S+)/i
} as const

// ⚡ Bolt: Pre-compile regular expressions to prevent recompilation on every invocation.
// Extracting these to module-scoped constants reduces memory allocation and garbage collection overhead
// in the query parsing hot path.
const RE_QUOTES = /^["']|["']$/g
const RE_SUBJECT = /\bSUBJECT\s+(.+)/i
const RE_WHITESPACE = /\s+/g

// ⚡ Bolt: Extract static array literals to prevent reallocation in V8 `for...of` loops
// in this frequently executed query parsing hot path.
const DATE_KEYWORDS = ['SINCE', 'BEFORE'] as const
const KV_KEYWORDS = ['FROM', 'TO'] as const
const UID_SEARCH_WINDOW_SIZE = 500
const RE_UID_SEQUENCE_SET = /^\d+(?::\d+)?(?:,\d+(?::\d+)?)*$/

function buildSearchCriteria(query: string): SearchObject {
  const trimmed = query.trim()
  if (!trimmed) return {}

  const upper = trimmed.toUpperCase()
  if (upper === 'ALL' || upper === '*') return {}

  const criteria: SearchObject = {}
  let remaining = trimmed

  // 1. Extract standalone flag keywords (no arguments).
  //    Check longer prefixes first to avoid partial matches (UNFLAGGED before FLAGGED, etc.)
  for (const { pattern, key, value } of FLAG_MATCHERS) {
    const nextRemaining = remaining.replace(pattern, ' ')
    if (nextRemaining !== remaining) {
      Object.assign(criteria, { [key]: value })
      remaining = nextRemaining.trim()
    }
  }

  // 2. Extract date clauses: SINCE YYYY-MM-DD, BEFORE YYYY-MM-DD
  for (const keyword of DATE_KEYWORDS) {
    const { valid, invalid } = DATE_MATCHERS[keyword]
    const dateMatch = remaining.match(valid)
    if (dateMatch) {
      const criteriaKey = keyword.toLowerCase() as keyof SearchObject
      Object.assign(criteria, { [criteriaKey]: new Date(dateMatch[1]!) })
      remaining = remaining.replace(dateMatch[0], ' ').trim()
    } else {
      const nextRemaining = remaining.replace(invalid, ' ')
      if (nextRemaining !== remaining) {
        throw new EmailMCPError(
          `Invalid date format in ${keyword} query`,
          'VALIDATION_ERROR',
          `Date must be YYYY-MM-DD format. Example: ${keyword} 2026-01-15`
        )
      }
    }
  }

  // 3. Extract FROM / TO (single token or quoted string)
  for (const keyword of KV_KEYWORDS) {
    const kvMatch = remaining.match(KV_MATCHERS[keyword])
    if (kvMatch) {
      const criteriaKey = keyword.toLowerCase() as keyof SearchObject
      Object.assign(criteria, { [criteriaKey]: kvMatch[1]!.replace(RE_QUOTES, '') })
      remaining = remaining.replace(kvMatch[0], ' ').trim()
    }
  }

  // 4. Extract explicit SUBJECT (captures until end -- all other keywords already consumed)
  const subjectMatch = remaining.match(RE_SUBJECT)
  if (subjectMatch) {
    criteria.subject = subjectMatch[1]!.trim().replace(RE_QUOTES, '')
    remaining = remaining.replace(subjectMatch[0], ' ').trim()
  }

  // 5. Any remaining text that wasn't consumed -> implicit subject search
  if (remaining && !criteria.subject) {
    criteria.subject = remaining
  }

  return Object.keys(criteria).length > 0 ? criteria : {}
}

/**
 * ESEARCH (RFC 4731) is folded into the IMAP4rev2 baseline, so rev2-only
 * servers often don't list it as a standalone capability string -- imapflow's
 * own internal capability check applies the same fallback (see
 * node_modules/imapflow/lib/tools.js hasCapability / IMAP4REV2_FOLDED_CAPABILITIES).
 * Mirroring that here means rev2 servers still get the single-round-trip
 * ESEARCH/PARTIAL fast path instead of always paying for windowed UID SEARCH.
 */
function hasEsearchCapability(client: ImapFlow): boolean {
  if (client.capabilities.has('ESEARCH')) return true
  return (
    client.enabled.has('IMAP4REV2') || (client.capabilities.has('IMAP4rev2') && !client.capabilities.has('IMAP4rev1'))
  )
}

function isValidUid(value: unknown, minUid: number, maxUid: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minUid && value <= maxUid
}

function isValidUidArray(value: unknown, minUid: number, maxUid: number, maxCount?: number): value is number[] {
  if (!Array.isArray(value) || (maxCount !== undefined && value.length > maxCount)) return false

  const seenUids = new Set<number>()
  return value.every((uid) => {
    if (!isValidUid(uid, minUid, maxUid) || seenUids.has(uid)) return false
    seenUids.add(uid)
    return true
  })
}

function isValidUidSequenceSet(value: string, limit: number, newestUid: number): boolean {
  if (!RE_UID_SEQUENCE_SET.test(value)) return false

  const seenUids = new Set<number>()
  for (const sequence of value.split(',')) {
    const [startToken, endToken] = sequence.split(':')
    const startUid = Number(startToken)
    const endUid = endToken === undefined ? startUid : Number(endToken)
    if (!isValidUid(startUid, 1, newestUid) || !isValidUid(endUid, 1, newestUid)) return false

    const low = Math.min(startUid, endUid)
    const high = Math.max(startUid, endUid)
    const rangeLength = high - low + 1
    if (!Number.isSafeInteger(rangeLength) || rangeLength > limit - seenUids.size) return false

    for (let uid = low; uid <= high; uid += 1) {
      if (seenUids.has(uid)) return false
      seenUids.add(uid)
    }
  }

  return true
}

function isValidPartialMessages(value: unknown, limit: number, newestUid: number): value is string | number[] {
  if (Array.isArray(value)) return isValidUidArray(value, 1, newestUid, limit)
  return typeof value === 'string' && isValidUidSequenceSet(value, limit, newestUid)
}

function isValidFallbackUids(value: unknown, low: number, high: number): value is number[] {
  return isValidUidArray(value, low, high)
}

/**
 * Scans backward from the newest UID in fixed-size bounded windows, combining
 * the caller's criteria with a UID SEARCH range per window, until at least
 * `limit` matches are found or the scan reaches UID 1. Used when ESEARCH
 * RETURN (PARTIAL) is unavailable or returns an unusable result, so a large
 * mailbox is never asked to hand back every matching UID in one response.
 */
async function searchNewestUidsInBoundedWindows(
  client: ImapFlow,
  criteria: SearchObject,
  limit: number
): Promise<number[]> {
  if (limit <= 0) return []

  const mailbox = client.mailbox
  if (!mailbox) throw new Error('IMAP mailbox is not selected')

  const { uidNext } = mailbox
  if (!Number.isSafeInteger(uidNext) || uidNext < 1) {
    throw new Error(`IMAP mailbox returned an invalid uidNext value: ${String(uidNext)}`)
  }

  const selectedUids: number[] = []
  const seenUids = new Set<number>()
  for (let high = uidNext - 1; high >= 1 && selectedUids.length < limit; high -= UID_SEARCH_WINDOW_SIZE) {
    const low = Math.max(1, high - UID_SEARCH_WINDOW_SIZE + 1)
    const searchResult = await client.search({ ...criteria, uid: `${low}:${high}` }, { uid: true })

    if (searchResult === false) throw new Error('IMAP UID SEARCH returned no result')
    if (!isValidFallbackUids(searchResult, low, high)) throw new Error('IMAP UID SEARCH returned invalid UIDs')

    for (const uid of searchResult) {
      if (seenUids.has(uid)) throw new Error('IMAP UID SEARCH returned duplicate UIDs')
      seenUids.add(uid)
      selectedUids.push(uid)
    }

    selectedUids.sort((left, right) => left - right)
    if (selectedUids.length > limit) selectedUids.splice(0, selectedUids.length - limit)
  }

  return selectedUids
}

/**
 * Selects the UIDs of the newest `limit` messages matching criteria. Prefers
 * ESEARCH RETURN (PARTIAL) -- a single round trip on capable servers -- and
 * only falls back to bounded descending UID-window searches when the server
 * has no ESEARCH capability, or its ESEARCH response resolves to `false` or
 * an object with no usable `partial` result. Never issues a plain UID SEARCH
 * with no UID range, which would ask the server to return every matching UID
 * in the mailbox.
 */
async function searchNewestUids(client: ImapFlow, criteria: SearchObject, limit: number): Promise<string | number[]> {
  if (limit <= 0) return []

  if (hasEsearchCapability(client)) {
    const searchResult = await client.search(criteria, {
      uid: true,
      returnOptions: [{ partial: `-${limit}:-1` }]
    })

    const partial =
      typeof searchResult === 'object' && searchResult !== null && !Array.isArray(searchResult)
        ? searchResult.partial
        : undefined

    const partialMessages: unknown = partial?.messages
    const mailbox = client.mailbox
    const newestUid =
      mailbox && Number.isSafeInteger(mailbox.uidNext) && mailbox.uidNext >= 1 ? mailbox.uidNext - 1 : null
    if (newestUid !== null && isValidPartialMessages(partialMessages, limit, newestUid)) return partialMessages
  }

  return searchNewestUidsInBoundedWindows(client, criteria, limit)
}

/**
 * Executes an asynchronous mapper function over an array with a concurrency limit.
 */
async function mapLimit<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let currentIndex = 0

  const worker = async () => {
    while (currentIndex < items.length) {
      const index = currentIndex++
      results[index] = await mapper(items[index]!)
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker())
  await Promise.all(workers)

  return results
}

/**
 * Extract a short snippet from email body
 */
async function extractSnippet(source: string | Buffer, maxLength = 200): Promise<string> {
  try {
    // ⚡ Bolt: Pass optimization flags to skip slow html-to-text processing (~12x speedup).
    // We don't need mailparser to do this because fastExtractSnippet handles HTML extraction.
    const options: SimpleParserOptions = { skipHtmlToText: true, skipTextToHtml: true, skipTextLinks: true }
    const parsed = await simpleParser(source, options)
    const text = parsed.text || (parsed.html ? fastExtractSnippet(parsed.html as string, maxLength) : '')
    if (!text) return ''
    // If we used fastExtractSnippet, it's already cleaned and truncated
    if (parsed.html && !parsed.text) return text
    const cleaned = text.replace(RE_WHITESPACE, ' ').trim()
    if (cleaned.length <= maxLength) return cleaned
    return `${cleaned.substring(0, maxLength)}...`
  } catch {
    return ''
  }
}

/**
 * Format email address from parsed address object
 */
function formatAddress(addr: AddressObject | AddressObject[] | string | undefined | null): string {
  if (!addr) return ''
  if (typeof addr === 'string') return addr
  if (Array.isArray(addr)) {
    return addr
      .map((obj) => formatAddress(obj))
      .filter(Boolean)
      .join(', ')
  }
  if (addr.text) return addr.text
  if (Array.isArray(addr.value)) {
    return addr.value.map((a: EmailAddress) => (a.name ? `${a.name} <${a.address}>` : a.address)).join(', ')
  }
  return ''
}

// ============================================================================
// Sent Folder
// ============================================================================

/** Cache for resolved sent folder paths per account */
const sentFolderCache = new Map<string, Promise<string>>()

/** Clear the sent folder path cache */
export function clearSentFolderCache(): number {
  const count = sentFolderCache.size
  sentFolderCache.clear()
  return count
}

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
function getErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') {
    return null
  }

  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? code : null
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error || typeof error === 'string') {
    return String(error instanceof Error ? error.message : error)
  }

  try {
    return JSON.stringify(error) ?? String(error)
  } catch {
    return String(error)
  }
}

function sanitizeSearchErrorMessage(error: unknown): string {
  const message = getErrorMessage(error).trim()
  if (!message) return 'Unable to search this account.'

  const sanitized = message
    .replace(/\b[a-z][a-z0-9+.-]{1,31}:\/\/[^\s<>"']+/gi, '[redacted URL]')
    .replace(/\b(?:device[-\s_]?code|user[-\s_]?code)\b(?:\s*[:=]\s*|\s+)?[^\s,;]+/gi, '[redacted OAuth code]')

  return `Unable to search this account: ${sanitized}`
}

function getUnavailableAccount(account: AccountConfig, error: unknown): UnavailableAccount {
  const code = getErrorCode(error)

  if (code === 'OAUTH_AUTH_REQUIRED') {
    return {
      account_id: account.id,
      account_email: account.email,
      code,
      reason: 'OAuth authentication required for this account.'
    }
  }

  if (code === 'OAUTH_REFRESH_FAILED') {
    return {
      account_id: account.id,
      account_email: account.email,
      code,
      reason: 'OAuth token refresh failed for this account.'
    }
  }

  return {
    account_id: account.id,
    account_email: account.email,
    code: 'IMAP_SEARCH_FAILED',
    reason: sanitizeSearchErrorMessage(error)
  }
}

export async function searchEmails(
  accounts: AccountConfig[],
  query: string,
  folder: string,
  limit: number
): Promise<SearchEmailResults> {
  const criteria = buildSearchCriteria(query)

  const accountPromises = accounts.map(
    async (
      account
    ): Promise<{
      summaries: EmailSummary[]
      unavailable?: UnavailableAccount
    }> => {
      try {
        const emails = await withConnection(account, async (client) => {
          const lock = await client.getMailboxLock(folder)
          try {
            const selectedUids = await searchNewestUids(client, criteria, limit)
            if (selectedUids.length === 0) return []

            const messages = await client.fetchAll(
              selectedUids,
              {
                uid: true,
                flags: true,
                envelope: true,

                source: { start: 0, maxLength: 512 }
              },
              { uid: true }
            )
            return messages.sort((left, right) => left.uid - right.uid)
          } finally {
            lock.release()
          }
        })

        // ⚡ Bolt: Execute CPU-intensive snippet extraction outside of the `withConnection` block.
        // This ensures the IMAP connection and mailbox lock are released as quickly as possible.
        // We use `mapLimit` with a concurrency of 5 instead of a sequential for...of loop or unbounded Promise.all
        // to improve performance without blocking the event loop or causing memory spikes from CPU-heavy MIME parsing.
        const summaries = await mapLimit(emails as FetchMessageObject[], 5, async (msg: FetchMessageObject) => {
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
            to: msg.envelope?.to?.map((a) => a.address).join(', ') || '',
            date: msg.envelope?.date?.toISOString() || '',
            flags: Array.from((msg.flags as Set<string> | string[]) || []),
            snippet
          }
        })

        return { summaries }
      } catch (error: unknown) {
        return {
          summaries: [],
          unavailable: getUnavailableAccount(account, error)
        }
      }
    }
  )

  const accountResults = await Promise.all(accountPromises)
  const results = accountResults.flatMap(({ summaries }) => summaries) as SearchEmailResults
  const unavailableAccounts = accountResults.flatMap(({ unavailable }) => (unavailable ? [unavailable] : []))

  Object.defineProperty(results, 'unavailableAccounts', {
    value: unavailableAccounts,
    enumerable: false
  })

  return results
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

  if (!fetchResult || typeof fetchResult === 'boolean' || !fetchResult.source) {
    throw new EmailMCPError(`Email UID ${uid} not found in ${folder}`, 'NOT_FOUND', 'Check the UID and folder')
  }

  // ⚡ Bolt: Pass optimization flags to skip slow default conversions.
  // We use our own `htmlToCleanText` (which is highly optimized) for HTML-only emails,
  // so we can safely bypass `mailparser`'s internal text generation.
  const options: SimpleParserOptions = { skipHtmlToText: true, skipTextToHtml: true, skipTextLinks: true }
  const parsed = await simpleParser(fetchResult.source, options)
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
    attachments: (parsed.attachments || []).map((att: Attachment) => ({
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
    return mailboxes.map((mb: ListResponse) => ({
      name: mb.name,
      path: mb.path,
      flags: Array.from(mb.flags || []),
      delimiter: mb.delimiter || '/'
    }))
  })
}

/**
 * Read STATUS metadata for one mailbox without selecting or enumerating it.
 */
export async function getFolderStatus(account: AccountConfig, folder: string): Promise<FolderStatusInfo> {
  return withConnection(account, async (client) => {
    const status = await client.status(folder, {
      messages: true,
      unseen: true,
      uidNext: true
    })
    const messages = status?.messages
    const unseen = status?.unseen
    const uidNext = status?.uidNext

    if (
      typeof messages !== 'number' ||
      !Number.isSafeInteger(messages) ||
      messages < 0 ||
      typeof unseen !== 'number' ||
      !Number.isSafeInteger(unseen) ||
      unseen < 0 ||
      typeof uidNext !== 'number' ||
      !Number.isSafeInteger(uidNext) ||
      uidNext < 0
    ) {
      throw new EmailMCPError(
        'IMAP STATUS returned incomplete metadata',
        'IMAP_STATUS_FAILED',
        'Verify that the folder exists and the IMAP server supports MESSAGES, UNSEEN, and UIDNEXT status items'
      )
    }

    return {
      messages,
      unseen,
      uid_next: uidNext
    }
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
  const fetchResult = await withConnection(account, async (client) => {
    const lock = await client.getMailboxLock(folder)
    try {
      return await client.fetchOne(`${uid}`, { source: true }, { uid: true })
    } finally {
      lock.release()
    }
  })

  if (!fetchResult || typeof fetchResult === 'boolean' || !fetchResult.source) {
    throw new EmailMCPError(`Email UID ${uid} not found`, 'NOT_FOUND', 'Check the UID and folder')
  }

  // ⚡ Bolt: Execute CPU-intensive MIME parsing outside of the `withConnection` block.
  // This ensures the IMAP connection and mailbox lock are released as quickly as possible,
  // preventing other concurrent operations from being blocked while we parse attachments.
  // We bypass slow HTML-to-text processing as we only need the attachments here.
  const options: SimpleParserOptions = { skipHtmlToText: true, skipTextToHtml: true, skipTextLinks: true }
  const parsed = await simpleParser(fetchResult.source, options)
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
}
