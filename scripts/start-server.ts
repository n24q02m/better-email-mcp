/**
 * Better Email MCP Server Starter
 * Routes: `auth` subcommand → OAuth2 flow, default → MCP server
 */

import { runAuth } from '../src/auth-cli.js'
import { initServer } from '../src/init-server.js'

async function main() {
  // Route `auth` subcommand to OAuth2 CLI
  if (process.argv[2] === 'auth') {
    await runAuth()
    return
  }

  try {
    await initServer()

    // Keep process running
    process.on('SIGINT', () => {
      console.error('\nShutting down Better Email MCP Server')
      process.exit(0)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

main()
