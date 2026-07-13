/**
 * SMTP Client
 * Send, reply, and forward emails via SMTP using Nodemailer
 */

import { marked } from 'marked'
import { createTransport } from 'nodemailer'
import type { AccountConfig } from './config.js'
import { EmailMCPError } from './errors.js'
import { EMAIL_SANITIZE_OPTIONS, sanitizeHtml } from './html-utils.js'
import { ensureValidToken } from './oauth2.js'

export interface EmailAttachment {
  filename: string
  content_base64: string
  content_type?: string
}

export interface SendEmailOptions {
  to: string
  subject: string
  body: string
  cc?: string
  bcc?: string
  in_reply_to?: string
  references?: string
  attachments?: EmailAttachment[]
}

export interface SendResult {
  success: boolean
  message_id: string
  raw?: Buffer
}

const MAX_ATTACHMENT_COUNT = 10

// 25MB is the lowest common total-message-size limit shared by Gmail and Outlook.
const MAX_ATTACHMENT_TOTAL_BYTES = 25 * 1024 * 1024

/**
 * Validate attachment count and estimated total size before any payload is decoded.
 * Size is estimated from base64 length (length * 3/4) so an oversized request is
 * rejected without paying the cost of decoding every attachment first.
 */
function validateAttachments(attachments: EmailAttachment[] | undefined): void {
  if (!attachments || attachments.length === 0) return

  if (attachments.length > MAX_ATTACHMENT_COUNT) {
    throw new EmailMCPError(
      `Too many attachments: ${attachments.length} (max ${MAX_ATTACHMENT_COUNT})`,
      'VALIDATION_ERROR',
      `Send at most ${MAX_ATTACHMENT_COUNT} attachments per email`
    )
  }

  let estimatedBytes = 0
  for (let i = 0; i < attachments.length; i++) {
    estimatedBytes += (attachments[i]!.content_base64.length * 3) / 4
  }

  if (estimatedBytes > MAX_ATTACHMENT_TOTAL_BYTES) {
    throw new EmailMCPError(
      `Attachments too large: ~${(estimatedBytes / (1024 * 1024)).toFixed(1)}MB (max ${MAX_ATTACHMENT_TOTAL_BYTES / (1024 * 1024)}MB)`,
      'VALIDATION_ERROR',
      'Reduce attachment size or count'
    )
  }
}

/**
 * Map base64 attachment payloads to Nodemailer's native attachment format.
 * Returns undefined (rather than an empty array) when there are no attachments,
 * so callers can omit the `attachments` key from mailOptions entirely.
 */
function mapAttachments(
  attachments: EmailAttachment[] | undefined
): Array<{ filename: string; content: Buffer; contentType?: string }> | undefined {
  if (!attachments || attachments.length === 0) return undefined

  return attachments.map((attachment) => ({
    filename: attachment.filename,
    content: Buffer.from(attachment.content_base64, 'base64'),
    contentType: attachment.content_type
  }))
}

/**
 * Create a Nodemailer transporter for the given account.
 * Enforces TLS for all connections to prevent STARTTLS downgrade attacks.
 * - Port 465: implicit TLS (secure: true)
 * - Port 587: STARTTLS with requireTLS to enforce upgrade
 * Uses OAuth2 XOAUTH2 for Outlook accounts with stored tokens.
 */
function createSmtpTransport(account: AccountConfig) {
  const isImplicitTls = account.smtp.secure || account.smtp.port === 465

  const auth =
    account.authType === 'oauth2'
      ? { type: 'OAuth2' as const, user: account.email, accessToken: account.oauth2!.accessToken }
      : { user: account.email, pass: account.password }

  return createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: isImplicitTls,
    requireTLS: !isImplicitTls,
    auth
  })
}

// ⚡ Bolt: Extract `marked` options into module-scoped constants.
// This prevents recreating configuration objects on every function call,
// significantly reducing allocation overhead during high-frequency email parsing.
const MARKED_OPTIONS: import('marked').MarkedOptions = { async: false, breaks: true }

/**
 * Convert markdown text to simple HTML for email.
 * Uses sanitize-html to sanitize the output HTML against XSS vectors like javascript: links.
 */
export function textToHtml(text: string): string {
  // marked.parse can return a Promise if async: true, but we use async: false
  const rawHtml = marked.parse(text, MARKED_OPTIONS) as string

  return sanitizeHtml(rawHtml, EMAIL_SANITIZE_OPTIONS)
}

/**
 * Build a raw RFC2822 message using Nodemailer's MailComposer.
 * Returns the exact bytes that can be sent via SMTP and/or appended to IMAP.
 */
async function buildRawMessage(mailOptions: {
  from: string
  to: string
  cc?: string
  bcc?: string
  subject: string
  text: string
  html: string
  inReplyTo?: string
  references?: string
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>
}): Promise<Buffer> {
  // Dynamic import to avoid TypeScript issues with Nodemailer's internal module
  const { default: MailComposer } = await import('nodemailer/lib/mail-composer/index.js')
  const composer = new MailComposer(mailOptions)
  return composer.compile().build()
}

/**
 * Collect all recipient addresses for the SMTP envelope.
 * When sending raw messages, Nodemailer doesn't parse headers —
 * the envelope must be provided separately with all RCPT TO addresses.
 */
function collectRecipients(...fields: (string | undefined)[]): string[] {
  const result: string[] = []
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i]
    if (!field) continue
    const parts = field.split(',')
    for (let j = 0; j < parts.length; j++) {
      const trimmed = parts[j]!.trim()
      if (trimmed) result.push(trimmed)
    }
  }
  return result
}

/**
 * Send a raw RFC2822 message via SMTP and return both the result and raw bytes.
 * Requires an explicit envelope because Nodemailer doesn't extract recipients
 * from raw message headers for SMTP delivery.
 */
async function sendRawMessage(
  account: AccountConfig,
  raw: Buffer,
  envelope: { from: string; to: string[] }
): Promise<{ messageId: string }> {
  // For OAuth2, ensure fresh token before creating transport
  if (account.authType === 'oauth2') {
    await ensureValidToken(account)
  }

  const transport = createSmtpTransport(account)
  try {
    const result = await transport.sendMail({ raw, envelope })
    return { messageId: result.messageId || '' }
  } finally {
    transport.close()
  }
}

/**
 * Send a new email
 */
export async function sendNewEmail(account: AccountConfig, options: SendEmailOptions): Promise<SendResult> {
  validateAttachments(options.attachments)
  const attachments = mapAttachments(options.attachments)

  const mailOptions = {
    from: account.email,
    to: options.to,
    cc: options.cc,
    bcc: options.bcc,
    subject: options.subject,
    text: options.body,
    html: textToHtml(options.body),
    ...(attachments ? { attachments } : {})
  }

  const raw = await buildRawMessage(mailOptions)
  const recipients = collectRecipients(options.to, options.cc, options.bcc)
  const result = await sendRawMessage(account, raw, { from: account.email, to: recipients })

  return {
    success: true,
    message_id: result.messageId,
    raw
  }
}

/**
 * Reply to an email (maintains thread via In-Reply-To and References headers)
 */
export async function replyToEmail(account: AccountConfig, options: SendEmailOptions): Promise<SendResult> {
  if (!options.in_reply_to) {
    throw new EmailMCPError(
      'in_reply_to is required for reply',
      'MISSING_PARAM',
      'Use email_read to get the message_id of the email you want to reply to'
    )
  }

  validateAttachments(options.attachments)
  const attachments = mapAttachments(options.attachments)

  const subject = options.subject.startsWith('Re:') ? options.subject : `Re: ${options.subject}`

  const mailOptions = {
    from: account.email,
    to: options.to,
    cc: options.cc,
    bcc: options.bcc,
    subject,
    text: options.body,
    html: textToHtml(options.body),
    inReplyTo: options.in_reply_to,
    references: options.references || options.in_reply_to,
    ...(attachments ? { attachments } : {})
  }

  const raw = await buildRawMessage(mailOptions)
  const recipients = collectRecipients(options.to, options.cc, options.bcc)
  const result = await sendRawMessage(account, raw, { from: account.email, to: recipients })

  return {
    success: true,
    message_id: result.messageId,
    raw
  }
}

/**
 * Forward an email
 */
export async function forwardEmail(
  account: AccountConfig,
  options: SendEmailOptions & { original_body: string }
): Promise<SendResult> {
  validateAttachments(options.attachments)
  const attachments = mapAttachments(options.attachments)

  const subject = options.subject.startsWith('Fwd:') ? options.subject : `Fwd: ${options.subject}`
  const body = `${options.body}\n\n---------- Forwarded message ----------\n${options.original_body}`

  const mailOptions = {
    from: account.email,
    to: options.to,
    cc: options.cc,
    bcc: options.bcc,
    subject,
    text: body,
    html: textToHtml(body),
    ...(attachments ? { attachments } : {})
  }

  const raw = await buildRawMessage(mailOptions)
  const recipients = collectRecipients(options.to, options.cc, options.bcc)
  const result = await sendRawMessage(account, raw, { from: account.email, to: recipients })

  return {
    success: true,
    message_id: result.messageId,
    raw
  }
}
