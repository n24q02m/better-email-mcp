/**
 * SMTP Client
 * Send, reply, and forward emails via SMTP using Nodemailer
 * Supports both App Password and OAuth XOAUTH2 authentication
 */

import { createTransport } from 'nodemailer'
import type { AccountConfig } from './config.js'
import { EmailMCPError } from './errors.js'
import { ensureFreshToken } from './oauth/refresh.js'

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
 * Supports both App Password (pass) and OAuth XOAUTH2 (accessToken)
 */
function createSmtpTransport(account: AccountConfig) {
  const auth =
    account.authType === 'oauth' && account.accessToken
      ? ({ type: 'OAuth2', user: account.email, accessToken: account.accessToken } as any)
      : { user: account.email, pass: account.password! }

  return createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth
  })
}

/**
 * Get an account with a fresh OAuth token (if applicable)
 */
async function withFreshAuth(account: AccountConfig): Promise<AccountConfig> {
  if (account.authType !== 'oauth') return account

  try {
    const freshToken = await ensureFreshToken(account.email)
    return { ...account, accessToken: freshToken }
  } catch (err: any) {
    throw new EmailMCPError(
      `OAuth token refresh failed for ${account.email}: ${err.message}`,
      'AUTH_ERROR',
      `Re-authenticate with: npx @n24q02m/better-email-mcp auth ${account.email}`
    )
  }
}

/**
 * Convert markdown-like text to simple HTML for email
 */
function textToHtml(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      if (line.startsWith('# ')) return `<h1>${line.substring(2)}</h1>`
      if (line.startsWith('## ')) return `<h2>${line.substring(3)}</h2>`
      if (line.startsWith('### ')) return `<h3>${line.substring(4)}</h3>`
      if (line.startsWith('- ')) return `<li>${line.substring(2)}</li>`
      if (line.startsWith('**') && line.endsWith('**')) return `<b>${line.slice(2, -2)}</b>`
      if (line.trim() === '') return '<br>'
      return `<p>${line}</p>`
    })
    .join('\n')
}

/**
 * Send a new email
 */
export async function sendNewEmail(
  account: AccountConfig,
  options: SendEmailOptions
): Promise<{ success: boolean; message_id: string }> {
  const freshAccount = await withFreshAuth(account)
  const transport = createSmtpTransport(freshAccount)

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

  const freshAccount = await withFreshAuth(account)
  const transport = createSmtpTransport(freshAccount)

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
  const freshAccount = await withFreshAuth(account)
  const transport = createSmtpTransport(freshAccount)

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
