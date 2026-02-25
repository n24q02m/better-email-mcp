/**
 * Better Email MCP Server Starter
 * Dispatches to auth CLI or MCP server based on arguments
 */

import { initServer } from '../src/init-server.js'
import { runAuthCli } from './auth-cli.js'

async function main() {
  // Check if first arg is 'auth' - dispatch to OAuth CLI
  const args = process.argv.slice(2)
  if (args[0] === 'auth') {
    await runAuthCli(args.slice(1))
    return
  }

  // Default: start MCP server
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
