/**
 * Better Email MCP Server
 * Using composite tools for human-friendly AI agent interactions
 *
 * Non-blocking startup: resolveCredentialState() checks env/config/tokens
 * synchronously (<10ms). If no credentials found, the server starts anyway
 * and tools return setup instructions with the relay URL.
 * Relay session + polling happen lazily on first tool call.
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { resolveCredentialState } from './credential-state.js'
import { type AccountConfig, loadConfig } from './tools/helpers/config.js'
import { ensureValidToken } from './tools/helpers/oauth2.js'
import { createMcpServer } from './tools/registry.js'

/**
 * Non-blocking environment setup.
 *
 * Resolution order (all fast, no network I/O):
 * 1. ENV VARS -- EMAIL_CREDENTIALS already set
 * 2. CONFIG FILE -- encrypted config from previous relay setup
 * 3. SAVED OAUTH TOKENS -- Outlook tokens from previous session
 * 4. NOTHING -- returns empty accounts, tools will trigger relay lazily
 */
async function setupEnvironment(): Promise<AccountConfig[]> {
  const credState = await resolveCredentialState()

  if (credState !== 'configured') {
    // No credentials available yet. Server starts without accounts.
    // Tools will return setup instructions with relay URL on first call.
    console.error('Server starting without credentials. Tools will guide setup on first call.')
    return []
  }

  // Credentials found -- load accounts normally
  const accounts = await loadConfig()

  if (accounts.length === 0) {
    console.error('Warning: No email accounts configured')
    console.error('Set EMAIL_CREDENTIALS to enable email tools')
    console.error('Format: email1:password1,email2:password2')
  } else {
    console.error(`Loaded ${accounts.length} email account(s)`)
  }

  // Proactive OAuth2 auth for Outlook accounts without stored tokens.
  // Triggers Device Code flow immediately so the user sees the sign-in link
  // at startup instead of waiting until the first tool call.
  await Promise.all(
    accounts.map(async (account) => {
      if (account.authType === 'oauth2' && !account.oauth2) {
        try {
          await ensureValidToken(account)
        } catch (err: any) {
          // ensureValidToken throws with sign-in instructions -- log to stderr.
          // Background poll is already running; tokens will be saved to disk
          // and picked up on the next tool call.
          console.error(err.message)
        }
      }
    })
  )

  return accounts
}

async function setupServer(accounts: AccountConfig[]): Promise<Server> {
  // Create and configure MCP server
  const server = createMcpServer(accounts)

  // Connect stdio transport
  const transport = new StdioServerTransport()
  await server.connect(transport)
  return server
}

export async function initServer() {
  const transport = process.env.TRANSPORT_MODE || 'stdio'

  if (transport === 'http') {
    const { startHttp } = await import('./transports/http.js')
    await startHttp()
    return
  }

  // Default: stdio mode -- non-blocking startup
  const accounts = await setupEnvironment()
  return setupServer(accounts)
}
