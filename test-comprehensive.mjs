import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const TIMEOUT = { timeout: 120000 }
const DELAY = 800 // ms between IMAP-heavy ops to avoid Gmail rate-limiting

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Helper: extract JSON from potentially wrapped email content, handle error responses
function parseResult(r) {
  if (r.isError) {
    throw new Error(r.content[0].text)
  }
  const text = r.content[0].text
  const match = text.match(/<untrusted_email_content>\s*([\s\S]*?)\s*<\/untrusted_email_content>/)
  const jsonStr = match ? match[1] : text
  return JSON.parse(jsonStr)
}

const t = new StdioClientTransport({
  command: 'node',
  args: ['bin/cli.mjs'],
  env: {
    EMAIL_CREDENTIALS: 'nqm2402@gmail.com:fmbyqrgvkivjjzjf,2402nqm@gmail.com:hcrdrvtjnmbcvkpc',
    PATH: process.env.PATH
  }
})
const client = new Client({ name: 'test', version: '1.0' })
await client.connect(t)

let passed = 0,
  failed = 0
const pass = (label) => {
  console.log('[PASS] ' + label)
  passed++
}
const fail = (label, err) => {
  console.log('[FAIL] ' + label + ': ' + (err.message || err))
  failed++
}

// --- TOOL 1: help ---
for (const toolName of ['messages', 'folders', 'attachments', 'send', 'help']) {
  try {
    const r = await client.callTool({ name: 'help', arguments: { tool_name: toolName } }, undefined, TIMEOUT)
    const d = parseResult(r)
    pass('help(tool_name=' + toolName + ') -> tool: ' + d.tool)
  } catch (e) {
    fail('help(tool_name=' + toolName + ')', e)
  }
}

// --- TOOL 2: folders - list ---
try {
  const r = await client.callTool({ name: 'folders', arguments: { action: 'list' } }, undefined, TIMEOUT)
  const d = parseResult(r)
  pass('folders.list (accounts: ' + d.total_accounts + ')')
} catch (e) {
  fail('folders.list', e)
}

// --- SEND test email first (to get a UID) ---
let testUid = null
try {
  const s = await client.callTool(
    {
      name: 'send',
      arguments: {
        action: 'new',
        account: 'nqm2402@gmail.com',
        to: 'nqm2402@gmail.com',
        subject: '[MCP ComprehensiveTest]',
        body: 'Test from local build comprehensive test.'
      }
    },
    undefined,
    TIMEOUT
  )
  const sd = parseResult(s)
  pass('send.new (success: ' + sd.success + ', msg_id: ' + (sd.message_id || 'none') + ')')
} catch (e) {
  fail('send.new', e)
}

// Wait a bit for SMTP delivery before searching
await sleep(3000)

// --- TOOL 3: messages.search (specific subject to be fast) ---
try {
  const r = await client.callTool(
    {
      name: 'messages',
      arguments: {
        action: 'search',
        query: 'SUBJECT [MCP ComprehensiveTest]',
        account: 'nqm2402@gmail.com',
        folder: 'INBOX',
        limit: 1
      }
    },
    undefined,
    TIMEOUT
  )
  const d = parseResult(r)
  testUid = d.messages && d.messages[0] ? d.messages[0].uid : null
  pass('messages.search (found: ' + d.total + ', uid: ' + testUid + ')')
} catch (e) {
  fail('messages.search', e)
}

// --- UID-dependent tests ---
if (testUid) {
  await sleep(DELAY)
  try {
    const r = await client.callTool(
      { name: 'messages', arguments: { action: 'read', uid: testUid, account: 'nqm2402@gmail.com', folder: 'INBOX' } },
      undefined,
      TIMEOUT
    )
    const d = parseResult(r)
    pass('messages.read (uid: ' + d.uid + ', subject: ' + (d.subject || '').slice(0, 40) + ')')
  } catch (e) {
    fail('messages.read', e)
  }

  await sleep(DELAY)
  try {
    await client.callTool(
      {
        name: 'messages',
        arguments: { action: 'mark_unread', uid: testUid, account: 'nqm2402@gmail.com', folder: 'INBOX' }
      },
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
      {
        name: 'messages',
        arguments: { action: 'mark_read', uid: testUid, account: 'nqm2402@gmail.com', folder: 'INBOX' }
      },
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
      { name: 'messages', arguments: { action: 'flag', uid: testUid, account: 'nqm2402@gmail.com', folder: 'INBOX' } },
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
      {
        name: 'messages',
        arguments: { action: 'unflag', uid: testUid, account: 'nqm2402@gmail.com', folder: 'INBOX' }
      },
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
      {
        name: 'attachments',
        arguments: { action: 'list', account: 'nqm2402@gmail.com', uid: testUid, folder: 'INBOX' }
      },
      undefined,
      TIMEOUT
    )
    const d = parseResult(r)
    pass('attachments.list (uid: ' + testUid + ', total: ' + d.total + ')')
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
          account: 'nqm2402@gmail.com',
          uid: testUid,
          folder: 'INBOX',
          body: 'Reply from comprehensive test.'
          // no `to` — should auto-derive from original.from
        }
      },
      undefined,
      TIMEOUT
    )
    const d = parseResult(r)
    pass('send.reply (success: ' + d.success + ', to: ' + d.to + ')')
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
          account: 'nqm2402@gmail.com',
          uid: testUid,
          folder: 'INBOX',
          to: '2402nqm@gmail.com',
          body: 'Forwarded from comprehensive test.'
        }
      },
      undefined,
      TIMEOUT
    )
    const d = parseResult(r)
    pass('send.forward (success: ' + d.success + ')')
  } catch (e) {
    fail('send.forward', e)
  }

  await sleep(DELAY)
  try {
    const r = await client.callTool(
      {
        name: 'messages',
        arguments: { action: 'archive', uid: testUid, account: 'nqm2402@gmail.com', folder: 'INBOX' }
      },
      undefined,
      TIMEOUT
    )
    const d = parseResult(r)
    pass('messages.archive (success: ' + d.success + ')')
  } catch (e) {
    fail('messages.archive', e)
  }
} else {
  fail('Skipping UID-dependent tests', new Error('No test email UID found'))
}

await client.close()
console.log('\n=== RESULT: ' + passed + ' passed, ' + failed + ' failed ===')
