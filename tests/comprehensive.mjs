#!/usr/bin/env node
/**
 * Comprehensive integration test for better-email-mcp.
 *
 * Requires at least 2 accounts (first = primary, second = forward target).
 * Usage: EMAIL_CREDENTIALS=a@gmail.com:pass1,b@gmail.com:pass2 node tests/comprehensive.mjs
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

if (!process.env.EMAIL_CREDENTIALS) {
  console.error('EMAIL_CREDENTIALS env var is required (at least 2 accounts)')
  console.error('Usage: EMAIL_CREDENTIALS=a@gmail.com:pass1,b@gmail.com:pass2 node tests/comprehensive.mjs')
  process.exit(1)
}

// Parse accounts from EMAIL_CREDENTIALS
const accounts = process.env.EMAIL_CREDENTIALS.split(',').map((c) => c.split(':')[0])
if (accounts.length < 2) {
  console.error('Need at least 2 accounts for comprehensive test')
  process.exit(1)
}
const PRIMARY = accounts[0]
const SECONDARY = accounts[1]

const TIMEOUT = { timeout: 120000 }
const DELAY = 800 // ms between IMAP-heavy ops to avoid rate-limiting

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function parseResult(r) {
  if (r.isError) throw new Error(r.content[0].text)
  const text = r.content[0].text
  const match = text.match(/<untrusted_email_content>\s*([\s\S]*?)\s*<\/untrusted_email_content>/)
  const jsonStr = match ? match[1] : text
  return JSON.parse(jsonStr)
}

const t = new StdioClientTransport({
  command: 'node',
  args: ['bin/cli.mjs'],
  env: {
    EMAIL_CREDENTIALS: process.env.EMAIL_CREDENTIALS,
    PATH: process.env.PATH
  }
})
const client = new Client({ name: 'test', version: '1.0' })
await client.connect(t)

let passed = 0,
  failed = 0
const pass = (label) => {
  console.log(`[PASS] ${label}`)
  passed++
}
const fail = (label, err) => {
  console.log(`[FAIL] ${label}: ${err.message || err}`)
  failed++
}

// --- help ---
for (const toolName of ['messages', 'folders', 'attachments', 'send', 'help']) {
  try {
    const r = await client.callTool({ name: 'help', arguments: { tool_name: toolName } }, undefined, TIMEOUT)
    const d = parseResult(r)
    pass(`help(tool_name=${toolName}) -> tool: ${d.tool}`)
  } catch (e) {
    fail(`help(tool_name=${toolName})`, e)
  }
}

// --- folders.list ---
try {
  const r = await client.callTool({ name: 'folders', arguments: { action: 'list' } }, undefined, TIMEOUT)
  const d = parseResult(r)
  pass(`folders.list (accounts: ${d.total_accounts})`)
} catch (e) {
  fail('folders.list', e)
}

// --- send.new (Gmail — saved_to_sent should be false, Gmail auto-saves) ---
let testUid = null
try {
  const s = await client.callTool(
    {
      name: 'send',
      arguments: {
        action: 'new',
        account: PRIMARY,
        to: PRIMARY,
        subject: '[MCP ComprehensiveTest]',
        body: 'Test from local build comprehensive test.'
      }
    },
    undefined,
    TIMEOUT
  )
  const sd = parseResult(s)
  if (PRIMARY.includes('gmail') && sd.saved_to_sent !== false) {
    fail('send.new saved_to_sent', new Error(`Gmail should skip, got ${sd.saved_to_sent}`))
  } else {
    pass(`send.new (saved_to_sent: ${sd.saved_to_sent}, msg_id: ${sd.message_id || 'none'})`)
  }
} catch (e) {
  fail('send.new', e)
}

await sleep(3000)

// --- messages.search ---
try {
  const r = await client.callTool(
    {
      name: 'messages',
      arguments: {
        action: 'search',
        query: 'SUBJECT [MCP ComprehensiveTest]',
        account: PRIMARY,
        folder: 'INBOX',
        limit: 1
      }
    },
    undefined,
    TIMEOUT
  )
  const d = parseResult(r)
  testUid = d.messages?.[0] ? d.messages[0].uid : null
  pass(`messages.search (found: ${d.total}, uid: ${testUid})`)
} catch (e) {
  fail('messages.search', e)
}

// --- UID-dependent tests ---
if (testUid) {
  await sleep(DELAY)
  try {
    const r = await client.callTool(
      { name: 'messages', arguments: { action: 'read', uid: testUid, account: PRIMARY, folder: 'INBOX' } },
      undefined,
      TIMEOUT
    )
    const d = parseResult(r)
    pass(`messages.read (uid: ${d.uid}, subject: ${(d.subject || '').slice(0, 40)})`)
  } catch (e) {
    fail('messages.read', e)
  }

  await sleep(DELAY)
  try {
    await client.callTool(
      { name: 'messages', arguments: { action: 'mark_unread', uid: testUid, account: PRIMARY, folder: 'INBOX' } },
      undefined,
      TIMEOUT
    )
    pass('messages.mark_unread')
  } catch (e) {
    fail('messages.mark_unread', e)
  }

  await sleep(DELAY)
  try {
    await client.callTool(
      { name: 'messages', arguments: { action: 'mark_read', uid: testUid, account: PRIMARY, folder: 'INBOX' } },
      undefined,
      TIMEOUT
    )
    pass('messages.mark_read')
  } catch (e) {
    fail('messages.mark_read', e)
  }

  await sleep(DELAY)
  try {
    await client.callTool(
      { name: 'messages', arguments: { action: 'flag', uid: testUid, account: PRIMARY, folder: 'INBOX' } },
      undefined,
      TIMEOUT
    )
    pass('messages.flag')
  } catch (e) {
    fail('messages.flag', e)
  }

  await sleep(DELAY)
  try {
    await client.callTool(
      { name: 'messages', arguments: { action: 'unflag', uid: testUid, account: PRIMARY, folder: 'INBOX' } },
      undefined,
      TIMEOUT
    )
    pass('messages.unflag')
  } catch (e) {
    fail('messages.unflag', e)
  }

  await sleep(DELAY)
  try {
    const r = await client.callTool(
      { name: 'attachments', arguments: { action: 'list', account: PRIMARY, uid: testUid, folder: 'INBOX' } },
      undefined,
      TIMEOUT
    )
    const d = parseResult(r)
    pass(`attachments.list (uid: ${testUid}, total: ${d.total})`)
  } catch (e) {
    fail('attachments.list', e)
  }

  await sleep(DELAY)
  try {
    const r = await client.callTool(
      {
        name: 'send',
        arguments: {
          action: 'reply',
          account: PRIMARY,
          uid: testUid,
          folder: 'INBOX',
          body: 'Reply from comprehensive test.'
        }
      },
      undefined,
      TIMEOUT
    )
    const d = parseResult(r)
    pass(`send.reply (success: ${d.success}, to: ${d.to})`)
  } catch (e) {
    fail('send.reply', e)
  }

  await sleep(DELAY)
  try {
    const r = await client.callTool(
      {
        name: 'send',
        arguments: {
          action: 'forward',
          account: PRIMARY,
          uid: testUid,
          folder: 'INBOX',
          to: SECONDARY,
          body: 'Forwarded from comprehensive test.'
        }
      },
      undefined,
      TIMEOUT
    )
    const d = parseResult(r)
    pass(`send.forward (success: ${d.success})`)
  } catch (e) {
    fail('send.forward', e)
  }

  await sleep(DELAY)
  try {
    const r = await client.callTool(
      { name: 'messages', arguments: { action: 'archive', uid: testUid, account: PRIMARY, folder: 'INBOX' } },
      undefined,
      TIMEOUT
    )
    const d = parseResult(r)
    pass(`messages.archive (success: ${d.success})`)
  } catch (e) {
    fail('messages.archive', e)
  }
} else {
  fail('Skipping UID-dependent tests', new Error('No test email UID found'))
}

await client.close()
console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`)
if (failed > 0) process.exit(1)
