/**
 * Better Email MCP Server Starter
 *
 * Wired via mcp-core's buildCli: `auth` subcommand routes to the OAuth2
 * device-code CLI (extra handler); bare/flag argv starts the MCP server
 * (config/relay/doctor/--version/-h built in).
 */

import { buildCli } from '@n24q02m/mcp-core'
import { runAuth } from '../src/auth-cli.js'
import { getVersion, initServer } from '../src/init-server.js'

const SERVER_NAME = 'better-email-mcp'

/**
 * `serve` entry point for `buildCli` (bare/flag argv routes here).
 *
 * `initServer()` already blocks until shutdown for http mode
 * (`transports/http.ts` waits on its own SIGINT/SIGTERM handler before
 * resolving), but for stdio mode `server.connect(transport)` resolves the
 * instant the stdin listener attaches, not once the session ends. If this
 * function returned right there, buildCli's
 * `.then((code) => process.exit(code))` would kill the process immediately
 * after startup. So stdio keeps this promise pending until SIGINT/SIGTERM,
 * mirroring the shutdown-wait pattern http already uses.
 */
async function serve(): Promise<number | undefined> {
  try {
    await initServer()
  } catch (error) {
    console.error('Failed to start server:', error)
    return 1
  }

  const isHttp =
    process.argv.includes('--http') || process.env.MCP_TRANSPORT === 'http' || process.env.TRANSPORT_MODE === 'http'
  if (isHttp) return 0

  await new Promise<void>((resolve) => {
    const shutdown = () => {
      console.error('\nShutting down Better Email MCP Server')
      resolve()
    }
    process.once('SIGINT', shutdown)
    process.once('SIGTERM', shutdown)
  })
  return undefined
}

buildCli(SERVER_NAME, {
  serve,
  version: getVersion(),
  extra: {
    auth: async () => {
      await runAuth()
      return 0
    }
  }
})(process.argv.slice(2)).then((code) => process.exit(code))
