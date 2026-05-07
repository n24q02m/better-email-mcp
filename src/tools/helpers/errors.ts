/**
 * Error Handling Utilities
 * AI-friendly error messages and suggestions for email operations
 */

interface RawError {
  message?: string
  name?: string
  code?: string | number
  status?: number
  responseCode?: number
  authenticationFailed?: boolean
  [key: string]: unknown
}

export class EmailMCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public suggestion?: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'EmailMCPError'
  }

  toJSON() {
    return {
      error: this.name,
      code: this.code,
      message: this.message,
      suggestion: this.suggestion,
      details: this.details
    }
  }
}

/**
 * Sanitize error object to remove sensitive information (passwords, tokens)
 */
function sanitizeErrorDetails(error: unknown): Record<string, unknown> | unknown {
  if (!error || typeof error !== 'object') return error

  const raw = error as RawError
  const safe: Record<string, unknown> = {
    message: raw.message,
    name: raw.name,
    code: raw.code
  }

  if (raw.status) safe.status = raw.status
  if (raw.responseCode) safe.responseCode = raw.responseCode

  return safe
}

/**
 * Enhance email-related errors with helpful context
 */
export function enhanceError(error: unknown): EmailMCPError {
  if (error instanceof EmailMCPError) {
    return error
  }

  const raw = error as RawError
  const message = raw.message || 'Unknown error occurred'

  // IMAP authentication errors
  if (message.includes('Invalid credentials') || message.includes('AUTHENTICATIONFAILED') || raw.authenticationFailed) {
    return new EmailMCPError(
      'Email authentication failed',
      'AUTH_FAILED',
      'Check that your email and App Password are correct. For Gmail: enable 2FA then create an App Password at https://myaccount.google.com/apppasswords. For Outlook: enable 2FA then create an App Password in security settings.'
    )
  }

  // Connection errors
  if (message.includes('ECONNREFUSED') || message.includes('ENOTFOUND') || message.includes('ETIMEDOUT')) {
    return new EmailMCPError(
      'Cannot connect to email server',
      'CONNECTION_ERROR',
      'Check your internet connection and verify the email server address is correct.'
    )
  }

  // TLS/SSL errors
  if (message.includes('CERT') || message.includes('SSL') || message.includes('TLS')) {
    return new EmailMCPError(
      'TLS/SSL connection error',
      'TLS_ERROR',
      'The email server certificate could not be verified. Check the server address and port.'
    )
  }

  // IMAP mailbox errors
  if (message.includes('Mailbox not found') || message.includes('NO [NONEXISTENT]')) {
    return new EmailMCPError(
      'Mailbox/folder not found',
      'FOLDER_NOT_FOUND',
      'Check the folder name. Use the folders tool to list available folders.'
    )
  }

  // SMTP errors
  if (raw.responseCode) {
    return handleSmtpError(raw)
  }

  // Configuration errors
  if (message.includes('EMAIL_CREDENTIALS')) {
    return new EmailMCPError(
      'EMAIL_CREDENTIALS environment variable is required',
      'CONFIG_ERROR',
      'Set EMAIL_CREDENTIALS in format: email1:password1,email2:password2'
    )
  }

  // Generic error
  return new EmailMCPError(
    message,
    'UNKNOWN_ERROR',
    'Please check your request and try again',
    sanitizeErrorDetails(error)
  )
}

/**
 * Handle SMTP-specific errors
 */
function handleSmtpError(error: RawError): EmailMCPError {
  const code = error.responseCode

  switch (code) {
    case 535:
      return new EmailMCPError(
        'SMTP authentication failed',
        'SMTP_AUTH_FAILED',
        'Check your email and App Password for the sending account.'
      )

    case 550:
      return new EmailMCPError(
        'Recipient address rejected',
        'RECIPIENT_REJECTED',
        'Check the recipient email address is correct and exists.'
      )

    case 552:
    case 554:
      return new EmailMCPError(
        'Message rejected by server',
        'MESSAGE_REJECTED',
        'The email was rejected. It may be too large or flagged as spam.'
      )

    default:
      return new EmailMCPError(
        error.message || `SMTP error ${code}`,
        `SMTP_${code}`,
        'Check the SMTP error code and try again.',
        sanitizeErrorDetails(error)
      )
  }
}

/**
 * Find the closest matching string from a list of valid options.
 * Uses bigram similarity for fuzzy matching.
 */
export function findClosestMatch(input: string, validOptions: string[]): string | null {
  if (!input || validOptions.length === 0) return null

  const lower = input.toLowerCase()
  let bestMatch: string | null = null
  let bestScore = 0

  // ⚡ Bolt: Pre-compute the input bigrams outside the loop.
  // This prevents redundant Set allocations and string slicing for the identical
  // input string on every iteration of validOptions, reducing overhead from O(N*M) to O(N+M).
  const inputBigrams = new Set<string>()
  for (let i = 0; i < lower.length - 1; i++) inputBigrams.add(lower.slice(i, i + 2))

  for (const option of validOptions) {
    const optionLower = option.toLowerCase()
    if (optionLower.startsWith(lower) || lower.startsWith(optionLower)) {
      return option
    }

    const optionBigrams = new Set<string>()
    for (let i = 0; i < optionLower.length - 1; i++) optionBigrams.add(optionLower.slice(i, i + 2))

    let overlap = 0
    for (const b of inputBigrams) {
      if (optionBigrams.has(b)) overlap++
    }
    const score = (2 * overlap) / (inputBigrams.size + optionBigrams.size)
    if (score > bestScore && score > 0.4) {
      bestScore = score
      bestMatch = option
    }
  }

  return bestMatch
}

/**
 * Create AI-readable error message
 */
export function aiReadableMessage(error: EmailMCPError): string {
  let message = `Error: ${error.message}`

  if (error.suggestion) {
    message += `\n\nSuggestion: ${error.suggestion}`
  }

  if (error.details) {
    message += `\n\nDetails: ${JSON.stringify(error.details, null, 2)}`
  }

  return message
}

/**
 * Suggest fixes based on error
 */
export function suggestFixes(error: EmailMCPError): string[] {
  const suggestions: string[] = []

  switch (error.code) {
    case 'AUTH_FAILED':
    case 'SMTP_AUTH_FAILED':
      suggestions.push('Verify your App Password is correct (not your regular password)')
      suggestions.push('For Gmail: https://myaccount.google.com/apppasswords')
      suggestions.push('For Outlook: Security settings → App passwords')
      suggestions.push('Ensure 2-Factor Authentication is enabled on your account')
      break

    case 'CONNECTION_ERROR':
      suggestions.push('Check your internet connection')
      suggestions.push('Verify the email server address')
      suggestions.push('Check if a firewall is blocking the connection')
      break

    case 'FOLDER_NOT_FOUND':
      suggestions.push('Use the folders tool to list available folders')
      suggestions.push('Folder names are case-sensitive')
      suggestions.push('Gmail uses labels (e.g. [Gmail]/All Mail) instead of traditional folders')
      break

    case 'CONFIG_ERROR':
      suggestions.push('Set EMAIL_CREDENTIALS environment variable')
      suggestions.push('Format: email1:password1,email2:password2')
      suggestions.push('Passwords with colons can use format: email:password:imap_host')
      break

    default:
      suggestions.push('Check the error message for details')
      suggestions.push('Try again in a few moments')
      suggestions.push('Verify your email account settings')
  }

  return suggestions
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<Args extends unknown[], Return>(
  fn: (...args: Args) => Promise<Return>
): (...args: Args) => Promise<Return> {
  return async (...args: Args): Promise<Return> => {
    try {
      return await fn(...args)
    } catch (error) {
      throw enhanceError(error)
    }
  }
}

/**
 * Create a standard error for unknown actions
 */
export function createUnknownActionError(action: string, supportedActions: string): EmailMCPError {
  return new EmailMCPError(`Unknown action: ${action}`, 'VALIDATION_ERROR', `Supported actions: ${supportedActions}`)
}
