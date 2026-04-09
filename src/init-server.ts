/**
 * Better Email MCP Server
 * Using composite tools for human-friendly AI agent interactions
 *
 * Non-blocking startup: resolveCredentialState() checks env/config/tokens
 * synchronously (<10ms). If no credentials found, the server starts anyway
 * and tools return setup instructions with the relay URL.
 * Relay session + polling happen lazily on first tool call.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { resolveCredentialState } from './credential-state.js'
import { type AccountConfig, loadConfig } from './tools/helpers/config.js'
import { ensureValidToken } from './tools/helpers/oauth2.js'
import { registerTools } from './tools/registry.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function getVersion(): string {
  // Walk up from __dirname to find package.json.
  // Needed because __dirname differs between contexts:
  //   - src/          (dev via tsx)
  //   - build/src/    (tsc output, referenced by "main" in package.json)
  //   - bin/          (esbuild bundle)
  try {
    let dir = __dirname
    for (let i = 0; i < 5; i++) {
      const pkgPath = join(dir, 'package.json')
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
        if (pkg.name === '@n24q02m/better-email-mcp') {
          return pkg.version ?? '0.0.0'
        }
      }
      dir = dirname(dir)
    }
    return '0.0.0'
  } catch {
    return '0.0.0'
  }
}

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

  // Register composite tools (credential-aware: returns setup instructions when unconfigured)
  registerTools(server, accounts)

  // Connect stdio transport
  const transport = new StdioServerTransport()
  await server.connect(transport)
  return server
}

export async function initServer() {
  const transport = process.env.TRANSPORT_MODE || 'stdio'

  if (transport === 'http') {
    const { startOAuthHttp } = await import('./transports/oauth-server.js')
    await startOAuthHttp()
    return
  }

  // Default: stdio mode -- non-blocking startup
  const accounts = await setupEnvironment()
  return setupServer(accounts)
}
