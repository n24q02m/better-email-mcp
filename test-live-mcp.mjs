#!/usr/bin/env node
/**
 * Phase 5 Live Comprehensive Test for better-email-mcp.
 *
 * Spawns the server via MCP SDK Client (StdioClientTransport),
 * communicates over JSON-RPC stdio, and tests all accessible operations.
 *
 * Usage:
 *   node test-live-mcp.mjs   # Offline tests only (no real email server needed)
 *
 * All tests use a fake EMAIL_CREDENTIALS so the server starts without
 * connecting to a real IMAP/SMTP server.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const TIMEOUT = { timeout: 15000 }

let passed = 0
let failed = 0
const results = []

function parse(r) {
  if (r.isError) throw new Error(r.content[0].text)
  return r.content[0].text
}

function ok(label, evidence = '') {
  passed++
  results.push({ label, status: 'PASS', evidence })
  console.log(`  [PASS] ${label}${evidence ? ` | ${evidence.slice(0, 80)}` : ''}`)
}

function fail(label, err) {
  failed++
  results.push({ label, status: 'FAIL', evidence: err })
  console.log(`  [FAIL] ${label} | ${err.slice(0, 120)}`)
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
const transport = new StdioClientTransport({
  command: 'node',
  args: ['bin/cli.mjs'],
  env: {
    EMAIL_CREDENTIALS: 'test@gmail.com:fake_password',
    PATH: process.env.PATH
  },
  cwd: import.meta.dirname || process.cwd()
})

const client = new Client({ name: 'live-test', version: '1.0.0' })
await client.connect(transport)
console.log('Server connected (fake credentials).\n')

// ---------------------------------------------------------------------------
// 1. listTools
// ---------------------------------------------------------------------------
console.log('--- Meta ---')

const toolsResult = await client.listTools()
const toolNames = toolsResult.tools.map((t) => t.name).sort()
const expectedTools = ['attachments', 'folders', 'help', 'messages', 'send']
if (JSON.stringify(toolNames) === JSON.stringify(expectedTools)) {
  ok('listTools', `tools=${JSON.stringify(toolNames)}`)
} else {
  fail('listTools', `Expected ${JSON.stringify(expectedTools)}, got ${JSON.stringify(toolNames)}`)
}

// ---------------------------------------------------------------------------
// 2. listResources
// ---------------------------------------------------------------------------
const resourcesResult = await client.listResources()
const resourceUris = resourcesResult.resources.map((r) => r.uri).sort()
const expectedUris = [
  'email://docs/attachments',
  'email://docs/folders',
  'email://docs/help',
  'email://docs/messages',
  'email://docs/send'
]
if (JSON.stringify(resourceUris) === JSON.stringify(expectedUris)) {
  ok('listResources', `uris=${JSON.stringify(resourceUris)}`)
} else {
  fail('listResources', `Expected ${JSON.stringify(expectedUris)}, got ${JSON.stringify(resourceUris)}`)
}

// ---------------------------------------------------------------------------
// 3-6. help(topic) for each of 4 help topics
// ---------------------------------------------------------------------------
console.log('\n--- help ---')

const helpTopics = ['messages', 'folders', 'attachments', 'send']

for (const topic of helpTopics) {
  try {
    const r = await client.callTool({ name: 'help', arguments: { tool_name: topic } }, undefined, TIMEOUT)
    const t = parse(r)
    if (t.length >= 100) {
      ok(`help(${topic})`, `${t.length} chars`)
    } else {
      fail(`help(${topic})`, `Too short: ${t.length} chars`)
    }
  } catch (e) {
    fail(`help(${topic})`, e.message)
  }
}

// ---------------------------------------------------------------------------
// 7. Error paths - missing/invalid action for each tool
// ---------------------------------------------------------------------------
console.log('\n--- Error paths ---')

// Helper: expect an error response (isError=true or error-like text)
async function expectError(label, name, args) {
  try {
    const r = await client.callTool({ name, arguments: args }, undefined, TIMEOUT)
    if (r.isError) {
      ok(label, r.content[0].text.slice(0, 80))
    } else {
      const t = r.content[0].text.toLowerCase()
      if (t.includes('error') || t.includes('unknown') || t.includes('invalid')) {
        ok(label, r.content[0].text.slice(0, 80))
      } else {
        fail(label, `Expected error, got: ${r.content[0].text.slice(0, 60)}`)
      }
    }
  } catch (e) {
    ok(label, `Error: ${e.message.slice(0, 60)}`)
  }
}

// messages: no action
await expectError('messages(no action)', 'messages', {})

// messages: invalid action
await expectError('messages(invalid action)', 'messages', {
  action: 'invalid'
})

// folders: no action
await expectError('folders(no action)', 'folders', {})

// attachments: no action
await expectError('attachments(no action)', 'attachments', {})

// send: no action
await expectError('send(no action)', 'send', {})

// help: invalid tool_name
await expectError('help(nonexistent)', 'help', { tool_name: 'nonexistent' })

// ---------------------------------------------------------------------------
// 8. messages with invalid args (search without query -> tries IMAP, fails)
// ---------------------------------------------------------------------------
console.log('\n--- Validation errors ---')

await expectError('messages(search, no query)', 'messages', {
  action: 'search'
})

// ---------------------------------------------------------------------------
// 9. send without required fields
// ---------------------------------------------------------------------------
await expectError('send(new, missing fields)', 'send', { action: 'new' })

// ---------------------------------------------------------------------------
// 10. Security: XSS in help tool_name
// ---------------------------------------------------------------------------
console.log('\n--- Security ---')

await expectError('help(XSS)', 'help', {
  tool_name: '<script>alert(1)</script>'
})

// ---------------------------------------------------------------------------
// 11. Action validation - messages (missing uid/account)
// ---------------------------------------------------------------------------
console.log('\n--- Messages action validation ---')

await expectError('messages(read, no uid)', 'messages', { action: 'read' })
await expectError('messages(mark_read, no uid)', 'messages', { action: 'mark_read' })
await expectError('messages(mark_unread, no uid)', 'messages', { action: 'mark_unread' })
await expectError('messages(flag, no uid)', 'messages', { action: 'flag' })
await expectError('messages(unflag, no uid)', 'messages', { action: 'unflag' })
await expectError('messages(move, no uid)', 'messages', { action: 'move' })
await expectError('messages(archive, no uid)', 'messages', { action: 'archive' })
await expectError('messages(trash, no uid)', 'messages', { action: 'trash' })

// ---------------------------------------------------------------------------
// 12. Action validation - attachments (missing uid/account)
// ---------------------------------------------------------------------------
console.log('\n--- Attachments action validation ---')

await expectError('attachments(list, no uid)', 'attachments', { action: 'list' })
await expectError('attachments(download, no uid)', 'attachments', { action: 'download' })

// ---------------------------------------------------------------------------
// 13. Action validation - send (missing uid for reply/forward)
// ---------------------------------------------------------------------------
console.log('\n--- Send action validation ---')

await expectError('send(reply, no uid)', 'send', { action: 'reply' })
await expectError('send(forward, no uid)', 'send', { action: 'forward' })

// ---------------------------------------------------------------------------
// 14. Action validation - folders
// ---------------------------------------------------------------------------
console.log('\n--- Folders action validation ---')

await expectError('folders(list)', 'folders', { action: 'list' })

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
await client.close()

const total = passed + failed
console.log(`\n${'='.repeat(60)}`)
console.log(`RESULT: ${passed}/${total} PASS (${((100 * passed) / total).toFixed(1)}%)`)
console.log(`${'='.repeat(60)}`)

if (failed > 0) {
  console.log('\nFailed tests:')
  for (const r of results) {
    if (r.status === 'FAIL') {
      console.log(`  - ${r.label}: ${r.evidence}`)
    }
  }
  process.exit(1)
}
