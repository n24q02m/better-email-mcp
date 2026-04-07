import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import type { AccountConfig } from './tools/helpers/config.js'
import { registerTools } from './tools/registry.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export function getVersion(): string {
  // Use npm_package_version if available
  if (process.env.npm_package_version) {
    return process.env.npm_package_version
  }

  // Fallback to walking up from __dirname to find package.json.
  try {
    let dir = __dirname
    for (let i = 0; i < 5; i++) {
      const pkgPath = join(dir, 'package.json')
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
        // Match project name from package.json
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
 * Shared factory to instantiate the Better Email MCP Server with core capabilities and registered tools.
 */
export function createMcpServer(accounts: AccountConfig[]): Server {
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

  return server
}
