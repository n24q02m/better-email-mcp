/**
 * SMTP Client
 * Send, reply, and forward emails via SMTP using Nodemailer
 */

import { marked } from 'marked'
import { createTransport } from 'nodemailer'
import type { AccountConfig } from './config.js'
import { EmailMCPError } from './errors.js'
import { escapeHtml } from './html-utils.js'

export interface SendEmailOptions {
  to: string
  subject: string
  body: string
  cc?: string
  bcc?: string
  in_reply_to?: string
  references?: string
}

/**
 * Create a Nodemailer transporter for the given account
 */
function createSmtpTransport(account: AccountConfig) {
  return createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: {
      user: account.email,
      pass: account.password
    }
  })
}

/**
 * Convert markdown text to simple HTML for email
 */
function textToHtml(text: string): string {
  // 1. Escape any HTML in the user input to prevent XSS
  const safeText = escapeHtml(text)

  // 2. Parse markdown securely using marked library
  return marked.parse(safeText, { async: false, breaks: true }) as string
}

/**
 * Send a new email
 */
export async function sendNewEmail(
  account: AccountConfig,
  options: SendEmailOptions
): Promise<{ success: boolean; message_id: string }> {
  const transport = createSmtpTransport(account)

  try {
    const result = await transport.sendMail({
      from: account.email,
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      subject: options.subject,
      text: options.body,
      html: textToHtml(options.body)
    })

    return {
      success: true,
      message_id: result.messageId || ''
    }
  } finally {
    transport.close()
  }
}

/**
 * Reply to an email (maintains thread via In-Reply-To and References headers)
 */
export async function replyToEmail(
  account: AccountConfig,
  options: SendEmailOptions
): Promise<{ success: boolean; message_id: string }> {
  if (!options.in_reply_to) {
    throw new EmailMCPError(
      'in_reply_to is required for reply',
      'MISSING_PARAM',
      'Use email_read to get the message_id of the email you want to reply to'
    )
  }

  const transport = createSmtpTransport(account)

  try {
    const subject = options.subject.startsWith('Re:') ? options.subject : `Re: ${options.subject}`

    const result = await transport.sendMail({
      from: account.email,
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      subject,
      text: options.body,
      html: textToHtml(options.body),
      inReplyTo: options.in_reply_to,
      references: options.references || options.in_reply_to
    })

    return {
      success: true,
      message_id: result.messageId || ''
    }
  } finally {
    transport.close()
  }
}

/**
 * Forward an email
 */
export async function forwardEmail(
  account: AccountConfig,
  options: SendEmailOptions & { original_body: string }
): Promise<{ success: boolean; message_id: string }> {
  const transport = createSmtpTransport(account)

  try {
    const subject = options.subject.startsWith('Fwd:') ? options.subject : `Fwd: ${options.subject}`
    const body = `${options.body}\n\n---------- Forwarded message ----------\n${options.original_body}`

    const result = await transport.sendMail({
      from: account.email,
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      subject,
      text: body,
      html: textToHtml(body)
    })

    return {
      success: true,
      message_id: result.messageId || ''
    }
  } finally {
    transport.close()
  }
}
