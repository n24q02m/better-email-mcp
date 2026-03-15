#!/usr/bin/env node
/**
 * Live Comprehensive Test for better-email-mcp.
 *
 * Spawns the server via MCP SDK Client (StdioClientTransport),
 * communicates over JSON-RPC stdio, and tests all accessible operations.
 *
 * Usage:
 *   EMAIL_CREDENTIALS=user@gmail.com:apppassword node test-live-mcp.mjs
 *   EMAIL_CREDENTIALS=user1@gmail.com:pass1,user2@outlook.com:pass2 node test-live-mcp.mjs
 *
 * EMAIL_CREDENTIALS is required. Tests all operations including real email.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

if (!process.env.EMAIL_CREDENTIALS) {
  console.error(
    'EMAIL_CREDENTIALS environment variable is required\n' +
      'Format: email1:password1,email2:password2\n\n' +
      'Examples:\n' +
      '  EMAIL_CREDENTIALS=user@gmail.com:abcd-efgh-ijkl-mnop\n' +
      '  EMAIL_CREDENTIALS=user1@gmail.com:pass1,user2@outlook.com:pass2\n\n' +
      'For Gmail: Enable 2FA, then create App Password at https://myaccount.google.com/apppasswords\n' +
      'For Outlook: Use app password from https://account.live.com/proofs/AppPassword'
  )
  process.exit(1)
}
const EMAIL_CREDENTIALS = process.env.EMAIL_CREDENTIALS
const HAS_REAL_CREDS = true
const TIMEOUT = { timeout: 30000 }

let passed = 0
let failed = 0
let skipped = 0
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

function skip(label, reason) {
  skipped++
  results.push({ label, status: 'SKIP', evidence: reason })
  console.log(`  [SKIP] ${label} | ${reason}`)
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
const transport = new StdioClientTransport({
  command: 'node',
  args: ['bin/cli.mjs'],
  env: { EMAIL_CREDENTIALS, PATH: process.env.PATH },
  cwd: import.meta.dirname || process.cwd()
})

const client = new Client({ name: 'live-test', version: '1.0.0' })
await client.connect(transport)
console.log(`Server connected. EMAIL_CREDENTIALS: ${HAS_REAL_CREDS ? 'real' : 'fake (limited tests)'}\n`)

// ---------------------------------------------------------------------------
// 1. listTools — verify 5 tools returned
// ---------------------------------------------------------------------------
console.log('--- Meta ---')

const toolsResult = await client.listTools()
const toolNames = toolsResult.tools.map((t) => t.name).sort()
const expected = ['attachments', 'folders', 'help', 'messages', 'send']

try {
  if (JSON.stringify(toolNames) === JSON.stringify(expected)) {
    ok('listTools returns 5 tools', toolNames.join(', '))
  } else {
    fail('listTools mismatch', `got: ${toolNames.join(', ')}`)
  }
} catch (e) {
  fail('listTools', e.message)
}

// Verify each tool has required fields
for (const tool of toolsResult.tools) {
  try {
    if (tool.name && tool.description && tool.inputSchema) {
      ok(`tool schema: ${tool.name}`, `desc=${tool.description.slice(0, 50)}`)
    } else {
      fail(`tool schema: ${tool.name}`, 'Missing name/description/inputSchema')
    }
  } catch (e) {
    fail(`tool schema: ${tool.name}`, e.message)
  }
}

// ---------------------------------------------------------------------------
// 2. listResources — verify documentation resources
// ---------------------------------------------------------------------------
try {
  const res = await client.listResources()
  const uris = res.resources.map((r) => r.uri).sort()
  if (uris.length === 5) {
    ok('listResources returns 5 docs', uris.join(', '))
  } else {
    fail('listResources count', `expected 5, got ${uris.length}: ${uris.join(', ')}`)
  }
} catch (e) {
  fail('listResources', e.message)
}

// ---------------------------------------------------------------------------
// 3. Help tool — all 5 tools
// ---------------------------------------------------------------------------
console.log('\n--- Help Tests ---')

const helpTools = ['messages', 'folders', 'attachments', 'send', 'help']
for (const toolName of helpTools) {
  try {
    const r = await client.callTool({ name: 'help', arguments: { tool_name: toolName } }, undefined, TIMEOUT)
    const text = parse(r)
    if (text.length > 50 && text.includes(toolName)) {
      ok(`help(${toolName})`, `${text.length} chars`)
    } else {
      fail(`help(${toolName})`, `Too short or missing tool name: ${text.slice(0, 50)}`)
    }
  } catch (e) {
    fail(`help(${toolName})`, e.message)
  }
}

// ---------------------------------------------------------------------------
// 4. Error paths — missing required fields
// ---------------------------------------------------------------------------
console.log('\n--- Error Paths ---')

// Missing action for messages
try {
  const r = await client.callTool({ name: 'messages', arguments: {} }, undefined, TIMEOUT)
  if (r.isError) {
    ok('messages: missing action → error', r.content[0].text.slice(0, 60))
  } else {
    fail('messages: missing action', 'Did not error')
  }
} catch (e) {
  ok('messages: missing action → error', e.message.slice(0, 60))
}

// Invalid action for messages
try {
  const r = await client.callTool({ name: 'messages', arguments: { action: 'nonexistent_action' } }, undefined, TIMEOUT)
  if (r.isError) {
    ok('messages: invalid action → error', r.content[0].text.slice(0, 60))
  } else {
    fail('messages: invalid action', 'Did not error')
  }
} catch (e) {
  ok('messages: invalid action → error', e.message.slice(0, 60))
}

// Missing action for folders
try {
  const r = await client.callTool({ name: 'folders', arguments: {} }, undefined, TIMEOUT)
  if (r.isError) {
    ok('folders: missing action → error', r.content[0].text.slice(0, 60))
  } else {
    // Some implementations default to "list" action
    ok('folders: missing action → handled', parse(r).slice(0, 60))
  }
} catch (e) {
  ok('folders: missing action → error', e.message.slice(0, 60))
}

// Missing required fields for attachments
try {
  const r = await client.callTool({ name: 'attachments', arguments: { action: 'list' } }, undefined, TIMEOUT)
  if (r.isError) {
    ok('attachments: missing account/uid → error', r.content[0].text.slice(0, 60))
  } else {
    fail('attachments: missing fields', 'Did not error')
  }
} catch (e) {
  ok('attachments: missing account/uid → error', e.message.slice(0, 60))
}

// Missing required fields for send
try {
  const r = await client.callTool({ name: 'send', arguments: { action: 'new' } }, undefined, TIMEOUT)
  if (r.isError) {
    ok('send: missing required → error', r.content[0].text.slice(0, 60))
  } else {
    fail('send: missing fields', 'Did not error')
  }
} catch (e) {
  ok('send: missing required → error', e.message.slice(0, 60))
}

// Invalid tool_name for help
try {
  const r = await client.callTool({ name: 'help', arguments: { tool_name: 'nonexistent' } }, undefined, TIMEOUT)
  if (r.isError) {
    ok('help: invalid tool_name → error', r.content[0].text.slice(0, 60))
  } else {
    fail('help: invalid tool_name', 'Did not error')
  }
} catch (e) {
  ok('help: invalid tool_name → error', e.message.slice(0, 60))
}

// ---------------------------------------------------------------------------
// 5. Validation tests
// ---------------------------------------------------------------------------
console.log('\n--- Validation Tests ---')

// Messages tool has correct action enum
try {
  const msgTool = toolsResult.tools.find((t) => t.name === 'messages')
  const actions = msgTool.inputSchema.properties.action.enum
  const expectedActions = ['search', 'read', 'mark_read', 'mark_unread', 'flag', 'unflag', 'move', 'archive', 'trash']
  if (JSON.stringify(actions) === JSON.stringify(expectedActions)) {
    ok('messages actions enum correct', actions.join(', '))
  } else {
    fail('messages actions enum', `got: ${actions}`)
  }
} catch (e) {
  fail('messages actions enum', e.message)
}

// Send tool has correct action enum
try {
  const sendTool = toolsResult.tools.find((t) => t.name === 'send')
  const actions = sendTool.inputSchema.properties.action.enum
  if (actions.includes('new') && actions.includes('reply') && actions.includes('forward')) {
    ok('send actions enum correct', actions.join(', '))
  } else {
    fail('send actions enum', `got: ${actions}`)
  }
} catch (e) {
  fail('send actions enum', e.message)
}

// Folders tool has list action
try {
  const folderTool = toolsResult.tools.find((t) => t.name === 'folders')
  const actions = folderTool.inputSchema.properties.action.enum
  if (actions.includes('list')) {
    ok('folders actions enum correct', actions.join(', '))
  } else {
    fail('folders actions enum', `got: ${actions}`)
  }
} catch (e) {
  fail('folders actions enum', e.message)
}

// Attachments tool has correct actions
try {
  const attTool = toolsResult.tools.find((t) => t.name === 'attachments')
  const actions = attTool.inputSchema.properties.action.enum
  if (actions.includes('list') && actions.includes('download')) {
    ok('attachments actions enum correct', actions.join(', '))
  } else {
    fail('attachments actions enum', `got: ${actions}`)
  }
} catch (e) {
  fail('attachments actions enum', e.message)
}

// Help tool_name has all 5 tools
try {
  const helpTool = toolsResult.tools.find((t) => t.name === 'help')
  const validNames = helpTool.inputSchema.properties.tool_name.enum
  if (validNames.length === 5 && validNames.includes('messages') && validNames.includes('send')) {
    ok('help tool_name enum correct', validNames.join(', '))
  } else {
    fail('help tool_name enum', `got: ${validNames}`)
  }
} catch (e) {
  fail('help enum', e.message)
}

// ---------------------------------------------------------------------------
// 6. API tests (only with real credentials)
// ---------------------------------------------------------------------------
if (HAS_REAL_CREDS) {
  console.log('\n--- API tests (real credentials) ---')
  const accounts = EMAIL_CREDENTIALS.split(',').map((c) => c.split(':')[0])
  const gmailAccounts = accounts.filter((a) => a.includes('gmail.com'))
  const outlookAccounts = accounts.filter((a) => a.includes('outlook.com'))
  const testAccount = gmailAccounts[0] || accounts[0]

  console.log(`Testing with ${accounts.length} account(s): ${accounts.join(', ')}`)

  // 6a. List folders
  try {
    const r = await client.callTool(
      { name: 'folders', arguments: { action: 'list', account: testAccount } },
      undefined,
      TIMEOUT
    )
    const text = parse(r)
    if (text.includes('INBOX') || text.toLowerCase().includes('inbox')) {
      ok(`folders.list(${testAccount})`, text.slice(0, 80))
    } else {
      fail(`folders.list(${testAccount})`, `No INBOX found: ${text.slice(0, 80)}`)
    }
  } catch (e) {
    fail(`folders.list(${testAccount})`, e.message)
  }

  // 6b. Search messages (unread)
  let foundUid = null
  try {
    const r = await client.callTool(
      { name: 'messages', arguments: { action: 'search', account: testAccount, query: 'ALL', limit: 3 } },
      undefined,
      TIMEOUT
    )
    const text = parse(r)
    ok(`messages.search(${testAccount}, ALL)`, text.slice(0, 80))
    // Try to extract a UID from results
    const uidMatch = text.match(/UID[:\s]+(\d+)/i) || text.match(/"uid":\s*(\d+)/)
    if (uidMatch) foundUid = parseInt(uidMatch[1], 10)
  } catch (e) {
    fail(`messages.search(${testAccount})`, e.message)
  }

  // 6c. Read a specific message if UID found
  if (foundUid) {
    try {
      const r = await client.callTool(
        { name: 'messages', arguments: { action: 'read', account: testAccount, uid: foundUid } },
        undefined,
        TIMEOUT
      )
      const text = parse(r)
      if (text.length > 10) {
        ok(`messages.read(uid=${foundUid})`, text.slice(0, 80))
      } else {
        fail(`messages.read(uid=${foundUid})`, 'Empty response')
      }
    } catch (e) {
      fail(`messages.read(uid=${foundUid})`, e.message)
    }

    // 6d. List attachments
    try {
      const r = await client.callTool(
        { name: 'attachments', arguments: { action: 'list', account: testAccount, uid: foundUid } },
        undefined,
        TIMEOUT
      )
      const text = parse(r)
      ok(`attachments.list(uid=${foundUid})`, text.slice(0, 80))
    } catch (e) {
      fail(`attachments.list(uid=${foundUid})`, e.message)
    }

    // 6e. Flag/unflag cycle
    try {
      await client.callTool(
        { name: 'messages', arguments: { action: 'flag', account: testAccount, uid: foundUid } },
        undefined,
        TIMEOUT
      )
      ok(`messages.flag(uid=${foundUid})`)
      await client.callTool(
        { name: 'messages', arguments: { action: 'unflag', account: testAccount, uid: foundUid } },
        undefined,
        TIMEOUT
      )
      ok(`messages.unflag(uid=${foundUid})`)
    } catch (e) {
      fail(`messages.flag/unflag(uid=${foundUid})`, e.message)
    }

    // 6f. Mark read/unread cycle
    try {
      await client.callTool(
        { name: 'messages', arguments: { action: 'mark_read', account: testAccount, uid: foundUid } },
        undefined,
        TIMEOUT
      )
      ok(`messages.mark_read(uid=${foundUid})`)
      await client.callTool(
        { name: 'messages', arguments: { action: 'mark_unread', account: testAccount, uid: foundUid } },
        undefined,
        TIMEOUT
      )
      ok(`messages.mark_unread(uid=${foundUid})`)
    } catch (e) {
      fail(`messages.mark_read/unread(uid=${foundUid})`, e.message)
    }
  } else {
    skip('messages.read', 'No UID found from search')
    skip('attachments.list', 'No UID found')
    skip('messages.flag/unflag', 'No UID found')
    skip('messages.mark_read/unread', 'No UID found')
  }

  // 6g. Send test email (self-send)
  if (gmailAccounts.length >= 2) {
    const from = gmailAccounts[0]
    const to = gmailAccounts[1]
    try {
      const r = await client.callTool(
        {
          name: 'send',
          arguments: {
            action: 'new',
            account: from,
            to,
            subject: `MCP Test ${Date.now()}`,
            body: 'Automated test from test-live-mcp.mjs. Safe to delete.'
          }
        },
        undefined,
        TIMEOUT
      )
      const text = parse(r)
      ok(`send.new(${from} → ${to})`, text.slice(0, 80))
    } catch (e) {
      fail(`send.new(${from} → ${to})`, e.message)
    }
  } else if (gmailAccounts.length === 1) {
    // Self-send
    const from = gmailAccounts[0]
    try {
      const r = await client.callTool(
        {
          name: 'send',
          arguments: {
            action: 'new',
            account: from,
            to: from,
            subject: `MCP Test ${Date.now()}`,
            body: 'Automated self-test from test-live-mcp.mjs. Safe to delete.'
          }
        },
        undefined,
        TIMEOUT
      )
      const text = parse(r)
      ok(`send.new(self: ${from})`, text.slice(0, 80))
    } catch (e) {
      fail(`send.new(self: ${from})`, e.message)
    }
  } else {
    skip('send.new', 'No Gmail accounts for send test')
  }

  // 6h. Test Outlook account if available
  for (const outlook of outlookAccounts) {
    try {
      const r = await client.callTool(
        { name: 'folders', arguments: { action: 'list', account: outlook } },
        undefined,
        TIMEOUT
      )
      const text = parse(r)
      ok(`folders.list(outlook: ${outlook})`, text.slice(0, 80))
    } catch (e) {
      // Outlook OAuth2 may need interactive auth - expected to fail in CI
      fail(`folders.list(outlook: ${outlook})`, e.message.slice(0, 120))
    }

    try {
      const r = await client.callTool(
        { name: 'messages', arguments: { action: 'search', account: outlook, query: 'ALL', limit: 3 } },
        undefined,
        TIMEOUT
      )
      const text = parse(r)
      ok(`messages.search(outlook: ${outlook})`, text.slice(0, 80))
    } catch (e) {
      fail(`messages.search(outlook: ${outlook})`, e.message.slice(0, 120))
    }
  }

  // 6i. Cross-account search
  try {
    const r = await client.callTool(
      { name: 'messages', arguments: { action: 'search', query: 'ALL', limit: 5 } },
      undefined,
      TIMEOUT
    )
    const text = parse(r)
    ok('messages.search(all accounts)', text.slice(0, 80))
  } catch (e) {
    fail('messages.search(all accounts)', e.message)
  }

  // 6j. Folders list all
  try {
    const r = await client.callTool({ name: 'folders', arguments: { action: 'list' } }, undefined, TIMEOUT)
    const text = parse(r)
    ok('folders.list(all accounts)', text.slice(0, 80))
  } catch (e) {
    fail('folders.list(all accounts)', e.message)
  }
} else {
  console.log('\n--- API tests (SKIPPED - no EMAIL_CREDENTIALS) ---')
  const apiTests = [
    'folders.list',
    'messages.search',
    'messages.read',
    'attachments.list',
    'messages.flag/unflag',
    'messages.mark_read/unread',
    'send.new',
    'outlook.folders',
    'outlook.search',
    'cross-account search',
    'folders all'
  ]
  for (const t of apiTests) {
    skip(t, 'Requires EMAIL_CREDENTIALS')
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n═══════════════════════════════════════════')
console.log(`TOTAL: ${passed + failed + skipped} | PASS: ${passed} | FAIL: ${failed} | SKIP: ${skipped}`)
console.log('═══════════════════════════════════════════')
if (failed > 0) {
  console.log('\nFailed tests:')
  for (const r of results.filter((r) => r.status === 'FAIL')) {
    console.log(`  - ${r.label}: ${r.evidence}`)
  }
}

await client.close()
process.exit(failed > 0 ? 1 : 0)
