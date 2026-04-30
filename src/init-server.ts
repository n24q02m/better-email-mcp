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
import { loadConfig } from './tools/helpers/config.js'
import { registerTools } from './tools/registry.js'

const SERVER_NAME = 'better-email-mcp'

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

export async function initServer() {
  const isStdio =
    process.argv.includes('--stdio') || process.env.MCP_TRANSPORT === 'stdio' || process.env.TRANSPORT_MODE === 'stdio'

  if (isStdio) {
    // Direct MCP SDK stdio transport (no daemon proxy hop).
    // See spec 2026-04-30-multi-mode-stdio-http-architecture.md Task 3.2.
    await resolveCredentialState()
    const accounts = await loadConfig()
    const server = new Server(
      { name: SERVER_NAME, version: getVersion() },
      { capabilities: { tools: {}, resources: {} } }
    )
    registerTools(server, accounts)
    const transport = new StdioServerTransport()
    await server.connect(transport)
    console.error(`[${SERVER_NAME}] Server started in stdio mode (v${getVersion()})`)
    return
  }

  // Default: HTTP mode via mcp-core runLocalServer (local OAuth 2.1 AS).
  // Multi-user OAuth (device code / upstream Outlook) deferred to Phase L2.
  const { startHttp } = await import('./transports/http.js')
  await startHttp()
}
