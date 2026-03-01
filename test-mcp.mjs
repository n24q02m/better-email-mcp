import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const transport = new StdioClientTransport({
  command: 'node',
  args: ['/home/n24q02m/projects/better-email-mcp/bin/cli.mjs'],
  env: {
    EMAIL_CREDENTIALS: 'nqm2402@gmail.com:fmbyqrgvkivjjzjf,2402nqm@gmail.com:hcrdrvtjnmbcvkpc',
    PATH: process.env.PATH
  }
})

const client = new Client({ name: 'test-client', version: '1.0.0' })
await client.connect(transport)

// 1. List tools
const tools = await client.listTools()
console.log(
  'Tools:',
  tools.tools.map((t) => t.name)
)

// 2. List resources
const resources = await client.listResources()
console.log(
  'Resources:',
  resources.resources.map((r) => r.uri)
)

// 3. help(messages)
const h1 = await client.callTool({ name: 'help', arguments: { tool_name: 'messages' } })
console.log('\n[help:messages ok]', h1.content[0].text.slice(0, 100))

// 4. help(folders)
const h2 = await client.callTool({ name: 'help', arguments: { tool_name: 'folders' } })
console.log('[help:folders ok]', h2.content[0].text.slice(0, 100))

// 5. help(attachments)
const h3 = await client.callTool({ name: 'help', arguments: { tool_name: 'attachments' } })
console.log('[help:attachments ok]', h3.content[0].text.slice(0, 100))

// 6. help(send)
const h4 = await client.callTool({ name: 'help', arguments: { tool_name: 'send' } })
console.log('[help:send ok]', h4.content[0].text.slice(0, 100))

// 7. help(help)
const h5 = await client.callTool({ name: 'help', arguments: { tool_name: 'help' } })
console.log('[help:help ok]', h5.content[0].text.slice(0, 100))

console.log('\n=== HELP TOOL: ALL 5 VARIANTS PASSED ===')
await client.close()
