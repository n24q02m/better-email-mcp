/**
 * Better Email MCP Server
 * Using composite tools for human-friendly AI agent interactions
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { type AccountConfig, loadConfig } from './tools/helpers/config.js'
import { ensureValidToken } from './tools/helpers/oauth2.js'
import { registerTools } from './tools/registry.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function getVersion(): string {
  try {
    const pkgPath = join(__dirname, '..', 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    return pkg.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

async function setupEnvironment(): Promise<AccountConfig[]> {
  // Load email accounts from environment
  const accounts = loadConfig()

  if (accounts.length === 0) {
    console.error('EMAIL_CREDENTIALS environment variable is required')
    console.error('Format: email1:password1,email2:password2')
    console.error('')
    console.error('Examples:')
    console.error('  EMAIL_CREDENTIALS=user@gmail.com:abcd-efgh-ijkl-mnop')
    console.error('  EMAIL_CREDENTIALS=user1@gmail.com:pass1,user2@outlook.com:pass2')
    console.error('')
    console.error('For Gmail: Enable 2FA, then create App Password at https://myaccount.google.com/apppasswords')
    console.error('For Outlook: OAuth2 sign-in is prompted automatically on first use')
    process.exit(1)
  }

  console.error(`Loaded ${accounts.length} email account(s)`)

  // Proactive OAuth2 auth for Outlook accounts without stored tokens.
  // Triggers Device Code flow immediately so the user sees the sign-in link
  // at startup instead of waiting until the first tool call.
  for (const account of accounts) {
    if (account.authType === 'oauth2' && !account.oauth2) {
      try {
        await ensureValidToken(account)
      } catch (err: any) {
        // ensureValidToken throws with sign-in instructions — log to stderr.
        // Background poll is already running; tokens will be saved to disk
        // and picked up on the next tool call.
        console.error(err.message)
      }
    }
  }

  return accounts
}

async function setupServer(accounts: AccountConfig[]): Promise<Server> {
  // Create MCP server
  const server = new Server(
    {
      name: '@n24q02m/better-email-mcp',
      version: getVersion()
    },
    {
      capabilities: {
        tools: {},
        resources: {}
      }
    }
  )

  // Register composite tools
  registerTools(server, accounts)

  // Connect stdio transport
  const transport = new StdioServerTransport()
  await server.connect(transport)
  return server
}

export async function initServer() {
  const accounts = await setupEnvironment()
  return setupServer(accounts)
}
