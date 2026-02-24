/**
 * Error Handling Utilities
 * AI-friendly error messages and suggestions for email operations
 */

export class EmailMCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public suggestion?: string,
    public details?: any
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
function sanitizeErrorDetails(error: any): any {
  if (!error || typeof error !== 'object') return error

  const safe: any = {
    message: error.message,
    name: error.name,
    code: error.code
  }

  if (error.status) safe.status = error.status
  if (error.responseCode) safe.responseCode = error.responseCode

  return safe
}

/**
 * Enhance email-related errors with helpful context
 */
export function enhanceError(error: any): EmailMCPError {
  const message = error.message || 'Unknown error occurred'

  // IMAP authentication errors
  if (
    message.includes('Invalid credentials') ||
    message.includes('AUTHENTICATIONFAILED') ||
    error.authenticationFailed
  ) {
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
  if (error.responseCode) {
    return handleSmtpError(error)
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
function handleSmtpError(error: any): EmailMCPError {
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
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return await fn(...args)
    } catch (error) {
      throw enhanceError(error)
    }
  }
}
