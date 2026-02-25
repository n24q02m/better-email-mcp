/**
 * Better Email MCP Server
 * Using composite tools for human-friendly AI agent interactions
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { loadConfig } from './tools/helpers/config.js'
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

export async function initServer() {
  // Load email accounts from environment
  const accounts = loadConfig()

  if (accounts.length === 0) {
    console.error('No email accounts configured. Use one of the following methods:')
    console.error('')
    console.error('Method 1: App Password (EMAIL_CREDENTIALS env var)')
    console.error('  EMAIL_CREDENTIALS=user@gmail.com:abcd-efgh-ijkl-mnop')
    console.error('  EMAIL_CREDENTIALS=user1@gmail.com:pass1,user2@outlook.com:pass2')
    console.error('')
    console.error('  Gmail: Enable 2FA, then create App Password at https://myaccount.google.com/apppasswords')
    console.error(
      '  Outlook: Enable 2FA, then go to https://account.microsoft.com/security > Advanced security options > App passwords'
    )
    console.error('')
    console.error('Method 2: OAuth (interactive browser login)')
    console.error('  npx @n24q02m/better-email-mcp auth setup google     # Configure Google OAuth client')
    console.error('  npx @n24q02m/better-email-mcp auth setup microsoft  # Configure Microsoft OAuth client')
    console.error('  npx @n24q02m/better-email-mcp auth user@gmail.com   # Authenticate an account')
    console.error('  npx @n24q02m/better-email-mcp auth --list           # List authenticated accounts')
    process.exit(1)
  }

  console.error(`Loaded ${accounts.length} email account(s): ${accounts.map((a) => a.email).join(', ')}`)

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
