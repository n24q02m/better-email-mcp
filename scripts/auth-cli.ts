/**
 * OAuth Authentication CLI
 * Interactive CLI for setting up OAuth credentials and authenticating email accounts
 *
 * Usage:
 *   npx @n24q02m/better-email-mcp auth setup google      # Configure Google OAuth client
 *   npx @n24q02m/better-email-mcp auth setup microsoft   # Configure Microsoft OAuth client
 *   npx @n24q02m/better-email-mcp auth user@gmail.com    # Authenticate an account
 *   npx @n24q02m/better-email-mcp auth --list            # List OAuth accounts
 *   npx @n24q02m/better-email-mcp auth --revoke EMAIL    # Revoke OAuth tokens
 */

import { createInterface } from 'node:readline'
import { runOAuthFlow } from '../src/tools/helpers/oauth/flow.js'
import { isOAuthSupported } from '../src/tools/helpers/oauth/providers.js'
import {
  deleteTokens,
  getConfigDir,
  listStoredAccounts,
  loadTokens,
  saveClientConfig
} from '../src/tools/helpers/oauth/store.js'

/**
 * Read a line from stdin (for interactive prompts)
 */
function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

/**
 * Read a line from stdin without echoing (for secrets)
 */
function promptSecret(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stderr.write(question)
    const stdin = process.stdin
    const wasRaw = stdin.isRaw
    if (stdin.isTTY) stdin.setRawMode(true)

    let input = ''
    const onData = (data: Buffer) => {
      const char = data.toString()
      if (char === '\n' || char === '\r') {
        stdin.removeListener('data', onData)
        if (stdin.isTTY && wasRaw !== undefined) stdin.setRawMode(wasRaw)
        process.stderr.write('\n')
        resolve(input.trim())
      } else if (char === '\x7f' || char === '\b') {
        // Backspace
        input = input.slice(0, -1)
      } else if (char === '\x03') {
        // Ctrl+C
        process.exit(1)
      } else {
        input += char
      }
    }
    stdin.resume()
    stdin.on('data', onData)
  })
}

/**
 * Setup OAuth client credentials for a provider
 */
async function setupProvider(provider: string): Promise<void> {
  const normalized = provider.toLowerCase()
  if (normalized !== 'google' && normalized !== 'microsoft') {
    console.error(`Unknown provider: ${provider}`)
    console.error('Supported providers: google, microsoft')
    process.exit(1)
  }

  console.error(`\nSetting up OAuth client for ${normalized}`)
  console.error('---')

  if (normalized === 'google') {
    console.error('1. Go to https://console.cloud.google.com/apis/credentials')
    console.error('2. Create an OAuth 2.0 Client ID (Desktop app or Web app)')
    console.error('3. Add http://localhost as an authorized redirect URI origin')
    console.error('4. Enable the Gmail API at https://console.cloud.google.com/apis/library/gmail.googleapis.com')
    console.error('')
  } else {
    console.error('1. Go to https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps')
    console.error(
      '2. Register a new application (Accounts in any organizational directory + personal Microsoft accounts)'
    )
    console.error('3. Add a Mobile and desktop redirect URI: http://localhost')
    console.error('4. Under API permissions, add: IMAP.AccessAsUser.All, SMTP.Send (Office 365 Exchange Online)')
    console.error('')
  }

  const clientId = await prompt('Client ID: ')
  if (!clientId) {
    console.error('Client ID is required')
    process.exit(1)
  }

  const clientSecret = await promptSecret('Client Secret: ')
  if (!clientSecret) {
    console.error('Client Secret is required')
    process.exit(1)
  }

  saveClientConfig({ provider: normalized, clientId, clientSecret })
  console.error(`\nOAuth client saved for ${normalized}`)
  console.error(`Config stored in: ${getConfigDir()}`)
  console.error(`\nNext: authenticate an account with:`)

  if (normalized === 'google') {
    console.error('  npx @n24q02m/better-email-mcp auth user@gmail.com')
  } else {
    console.error('  npx @n24q02m/better-email-mcp auth user@outlook.com')
  }
}

/**
 * List all OAuth-authenticated accounts
 */
function listAccounts(): void {
  const accounts = listStoredAccounts()

  if (accounts.length === 0) {
    console.error('No OAuth accounts configured.')
    console.error('\nTo authenticate an account:')
    console.error('  npx @n24q02m/better-email-mcp auth user@gmail.com')
    return
  }

  console.error(`\nOAuth accounts (${accounts.length}):`)
  for (const email of accounts) {
    const tokens = loadTokens(email)
    if (tokens) {
      const expired = Date.now() >= tokens.tokenExpiry
      const status = expired ? 'expired (will auto-refresh)' : 'active'
      console.error(`  ${email} [${tokens.provider}] - ${status}`)
    } else {
      console.error(`  ${email} - unable to read tokens`)
    }
  }
  console.error(`\nConfig directory: ${getConfigDir()}`)
}

/**
 * Revoke OAuth tokens for an account
 */
function revokeAccount(email: string): void {
  const deleted = deleteTokens(email)
  if (deleted) {
    console.error(`OAuth tokens removed for ${email}`)
  } else {
    console.error(`No OAuth tokens found for ${email}`)
  }
}

/**
 * Authenticate an email account via OAuth
 */
async function authenticateAccount(email: string): Promise<void> {
  if (!email.includes('@')) {
    console.error(`Invalid email: ${email}`)
    process.exit(1)
  }

  if (!isOAuthSupported(email)) {
    console.error(`OAuth is not supported for ${email}`)
    console.error('Supported: Gmail (gmail.com), Outlook (outlook.com, hotmail.com, live.com)')
    console.error('\nUse App Password instead:')
    console.error(`  EMAIL_CREDENTIALS=${email}:your-app-password`)
    process.exit(1)
  }

  try {
    const result = await runOAuthFlow(email)
    console.error(`\nAuthentication successful for ${result.email} (${result.provider})`)
    console.error('The MCP server will now automatically use OAuth for this account.')
    console.error('\nNo EMAIL_CREDENTIALS env var needed for this account.')
  } catch (err: any) {
    console.error(`\nAuthentication failed: ${err.message}`)
    process.exit(1)
  }
}

/**
 * Print usage help
 */
function printHelp(): void {
  console.error('Usage: npx @n24q02m/better-email-mcp auth <command>')
  console.error('')
  console.error('Commands:')
  console.error('  setup <provider>    Configure OAuth client (google or microsoft)')
  console.error('  <email>             Authenticate an email account via OAuth')
  console.error('  --list              List all OAuth-authenticated accounts')
  console.error('  --revoke <email>    Remove OAuth tokens for an account')
  console.error('  --help              Show this help')
  console.error('')
  console.error('Examples:')
  console.error('  npx @n24q02m/better-email-mcp auth setup google')
  console.error('  npx @n24q02m/better-email-mcp auth user@gmail.com')
  console.error('  npx @n24q02m/better-email-mcp auth --list')
  console.error('  npx @n24q02m/better-email-mcp auth --revoke user@gmail.com')
}

/**
 * Main CLI entry point
 */
export async function runAuthCli(args: string[]): Promise<void> {
  const command = args[0]

  if (!command || command === '--help' || command === '-h') {
    printHelp()
    return
  }

  if (command === '--list' || command === '-l') {
    listAccounts()
    return
  }

  if (command === '--revoke' || command === '-r') {
    const email = args[1]
    if (!email) {
      console.error('Email is required for --revoke')
      process.exit(1)
    }
    revokeAccount(email)
    return
  }

  if (command === 'setup') {
    const provider = args[1]
    if (!provider) {
      console.error('Provider is required: google or microsoft')
      process.exit(1)
    }
    await setupProvider(provider)
    return
  }

  // Default: treat as email address to authenticate
  await authenticateAccount(command)
}
