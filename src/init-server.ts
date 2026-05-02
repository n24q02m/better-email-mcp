/**
 * Better Email MCP Server — Entry point
 *
 * Transport selection (default flipped 2026-05-01 per spec
 * 2026-05-01-stdio-pure-http-multiuser.md §5.2.1):
 *  - stdio (DEFAULT): MCP SDK StdioServerTransport directly. Requires
 *    EMAIL_PROVIDER + EMAIL_USER + EMAIL_APP_PASSWORD env vars.
 *  - http: Opt-in via `--http`, `MCP_TRANSPORT=http`, or `TRANSPORT_MODE=http`.
 *    Single-mode multi-user relay form (paste email/app-password OR Outlook
 *    OAuth via bundled client_id).
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
  const isHttp =
    process.argv.includes('--http') || process.env.MCP_TRANSPORT === 'http' || process.env.TRANSPORT_MODE === 'http'

  if (isHttp) {
    const { startHttp } = await import('./transports/http.js')
    await startHttp()
    return
  }

  // Default: stdio mode. Requires EMAIL_PROVIDER + EMAIL_USER + EMAIL_APP_PASSWORD.
  const missing: string[] = []
  if (!process.env.EMAIL_PROVIDER) missing.push('EMAIL_PROVIDER')
  if (!process.env.EMAIL_USER) missing.push('EMAIL_USER')
  if (!process.env.EMAIL_APP_PASSWORD) missing.push('EMAIL_APP_PASSWORD')
  if (missing.length > 0) {
    const msg = `[${SERVER_NAME}] Missing required env vars for stdio mode: ${missing.join(', ')}

Options:
  1. Set env vars in plugin config:
     {"command": "npx", "args": [...], "env": {"EMAIL_PROVIDER": "gmail", "EMAIL_USER": "...", "EMAIL_APP_PASSWORD": "..."}}

  2. Switch to HTTP mode (browser-based setup with bundled Outlook OAuth):
     See docs/setup-manual.md "Method 5: Self-Hosting HTTP Mode"

Documentation: https://github.com/n24q02m/better-email-mcp#setup
`
    process.stderr.write(msg)
    process.exit(1)
  }

  // Direct MCP SDK stdio transport (no daemon proxy hop).
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
}
