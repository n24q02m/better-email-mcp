/**
 * CLI for OAuth2 authentication (Device Code flow)
 *
 * Usage: npx @n24q02m/better-email-mcp auth user@outlook.com
 */

import { deviceCodeAuth, isOutlookDomain } from './tools/helpers/oauth2.js'

export async function runAuth(): Promise<void> {
  const email = process.argv[3]?.trim()

  if (!email) {
    console.error('Usage: better-email-mcp auth <email>')
    console.error('Example: better-email-mcp auth user@outlook.com')
    console.error('')
    console.error('Authenticates an Outlook/Hotmail/Live account via OAuth2 Device Code flow.')
    console.error('Tokens are saved to ~/.better-email-mcp/tokens.json')
    process.exit(1)
  }

  if (!isOutlookDomain(email)) {
    console.error(`OAuth2 auth is only needed for Outlook/Hotmail/Live accounts.`)
    console.error(`For ${email}, use an App Password in EMAIL_CREDENTIALS instead.`)
    process.exit(1)
  }

  try {
    await deviceCodeAuth(email)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`\nError: ${message}`)
    process.exit(1)
  }
}
