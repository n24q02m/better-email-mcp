import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const transport = new StdioClientTransport({
  command: 'node',
  args: ['/home/n24q02m/projects/better-email-mcp/bin/cli.mjs'],
  env: {
    EMAIL_CREDENTIALS: 'nqm2402@gmail.com:fmbyqrgvkivjjzjf',
    PATH: process.env.PATH
  }
})

const client = new Client({ name: 'test-client', version: '1.0.0' })
await client.connect(transport)

const pass = (label) => console.log('[PASS] ' + label)
const fail = (label, e) => console.log('[FAIL] ' + label + ': ' + e.message)

// Test 1: folders - list (single account)
try {
  const r = await client.callTool({ name: 'folders', arguments: { action: 'list', account_id: 'nqm2402@gmail.com' } })
  const parsed = JSON.parse(r.content[0].text)
  const count =
    parsed.accounts && parsed.accounts[0] && parsed.accounts[0].folders ? parsed.accounts[0].folders.length : 0
  pass('folders list (' + count + ' folders)')
} catch (e) {
  fail('folders list', e)
}

// Test 2: messages - search UNSEEN
try {
  const r = await client.callTool({
    name: 'messages',
    arguments: { action: 'search', query: 'UNSEEN', account_id: 'nqm2402@gmail.com', limit: 2 }
  })
  const parsed = JSON.parse(r.content[0].text)
  pass('messages search (' + (parsed.total_results || 0) + ' results)')
} catch (e) {
  fail('messages search', e)
}

// Test 3: attachments - list
try {
  const r = await client.callTool({
    name: 'attachments',
    arguments: { action: 'list', account_id: 'nqm2402@gmail.com', folder: 'INBOX', limit: 2 }
  })
  const parsed = JSON.parse(r.content[0].text)
  pass('attachments list (' + (parsed.total_emails_scanned || 0) + ' scanned)')
} catch (e) {
  fail('attachments list', e)
}

await client.close()
console.log('\n=== IMAP TESTS DONE ===')
