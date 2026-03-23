/**
 * Full/Real Email MCP Protocol Tests
 *
 * Spawns the actual MCP server via stdio and exercises ALL email operations
 * against a real Gmail account using App Passwords.
 *
 * Requires: EMAIL_CREDENTIALS env var with a valid Gmail account + app password.
 * Self-send only -- never sends to external addresses.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const EMAIL_CREDS = process.env.EMAIL_CREDENTIALS || 'quangminh2422004@gmail.com:uapjhmukdsimwigb'
const TEST_ACCOUNT = EMAIL_CREDS.split(',')[0]!.split(':')[0]!
const TEST_SUBJECT = `[MCP-TEST-${Date.now()}]`

/** Parse JSON from the MCP tool result text, stripping the wrapper lines */
function parseResult(result: any): any {
  const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? ''
  // The server wraps results with header/footer lines -- extract the JSON block
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`No JSON in response: ${text}`)
  return JSON.parse(jsonMatch[0])
}

/** Helper to wait for email delivery */
function waitForDelivery(ms = 5000): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

describe('Full Email MCP Protocol Tests (live Gmail)', () => {
  let client: Client
  let transport: StdioClientTransport

  // Track UIDs of test emails for cleanup
  const testUids: number[] = []

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: 'node',
      args: ['bin/cli.mjs'],
      env: {
        ...process.env,
        EMAIL_CREDENTIALS: EMAIL_CREDS,
        NODE_ENV: 'test'
      },
      stderr: 'pipe'
    })
    client = new Client({ name: 'full-test', version: '1.0.0' })
    await client.connect(transport)
  }, 30_000)

  afterAll(async () => {
    // Cleanup: trash all test emails
    if (testUids.length > 0) {
      try {
        await client.callTool({
          name: 'messages',
          arguments: {
            action: 'trash',
            account: TEST_ACCOUNT,
            uids: testUids
          }
        })
      } catch {
        // Best-effort cleanup
      }
    }
    await transport.close()
  })

  // -------------------------------------------------------------------------
  // folders
  // -------------------------------------------------------------------------
  describe('folders', () => {
    it('should list folders and include INBOX', async () => {
      const result = await client.callTool({
        name: 'folders',
        arguments: { action: 'list', account: TEST_ACCOUNT }
      })

      expect(result.isError).toBeFalsy()
      const data = parseResult(result)
      expect(data.action).toBe('list')
      expect(data.total_accounts).toBeGreaterThanOrEqual(1)

      const accountFolders = data.accounts[0]
      expect(accountFolders.account_email).toBe(TEST_ACCOUNT)
      expect(accountFolders.folders.length).toBeGreaterThan(0)

      const folderPaths = accountFolders.folders.map((f: any) => f.path)
      expect(folderPaths).toContain('INBOX')
    }, 30_000)
  })

  // -------------------------------------------------------------------------
  // send + messages lifecycle
  // -------------------------------------------------------------------------
  describe('send + messages lifecycle', () => {
    let sentUid: number

    it('send.new -- send email to self', async () => {
      const result = await client.callTool({
        name: 'send',
        arguments: {
          action: 'new',
          account: TEST_ACCOUNT,
          to: TEST_ACCOUNT,
          subject: TEST_SUBJECT,
          body: `Test body for ${TEST_SUBJECT}`
        }
      })

      expect(result.isError).toBeFalsy()
      const data = parseResult(result)
      expect(data.action).toBe('new')
      expect(data.success).toBe(true)
      expect(data.from).toBe(TEST_ACCOUNT)
      expect(data.to).toBe(TEST_ACCOUNT)
      expect(data.subject).toBe(TEST_SUBJECT)
      expect(data.message_id).toBeTruthy()
    }, 30_000)

    it('messages.search -- find the sent email by subject', async () => {
      await waitForDelivery(5000)

      const result = await client.callTool({
        name: 'messages',
        arguments: {
          action: 'search',
          account: TEST_ACCOUNT,
          query: `SUBJECT "${TEST_SUBJECT}"`,
          folder: 'INBOX',
          limit: 5
        }
      })

      expect(result.isError).toBeFalsy()
      const data = parseResult(result)
      expect(data.action).toBe('search')
      expect(data.total).toBeGreaterThanOrEqual(1)

      const found = data.messages.find((m: any) => m.subject?.includes('[MCP-TEST-'))
      expect(found).toBeDefined()
      sentUid = found.uid
      testUids.push(sentUid)
    }, 60_000)

    it('messages.read -- read the email and verify body', async () => {
      expect(sentUid).toBeDefined()

      const result = await client.callTool({
        name: 'messages',
        arguments: {
          action: 'read',
          account: TEST_ACCOUNT,
          uid: sentUid
        }
      })

      expect(result.isError).toBeFalsy()
      const data = parseResult(result)
      expect(data.action).toBe('read')
      expect(data.subject).toContain('[MCP-TEST-')
      expect(data.body_text).toContain('Test body for')
    }, 30_000)

    it('messages.mark_read -- mark as read', async () => {
      expect(sentUid).toBeDefined()

      const result = await client.callTool({
        name: 'messages',
        arguments: {
          action: 'mark_read',
          account: TEST_ACCOUNT,
          uid: sentUid
        }
      })

      expect(result.isError).toBeFalsy()
      const data = parseResult(result)
      expect(data.action).toBe('mark_read')
      expect(data.account).toBe(TEST_ACCOUNT)
    }, 30_000)

    it('messages.mark_unread -- mark as unread', async () => {
      expect(sentUid).toBeDefined()

      const result = await client.callTool({
        name: 'messages',
        arguments: {
          action: 'mark_unread',
          account: TEST_ACCOUNT,
          uid: sentUid
        }
      })

      expect(result.isError).toBeFalsy()
      const data = parseResult(result)
      expect(data.action).toBe('mark_unread')
      expect(data.account).toBe(TEST_ACCOUNT)
    }, 30_000)

    it('messages.flag -- flag the message', async () => {
      expect(sentUid).toBeDefined()

      const result = await client.callTool({
        name: 'messages',
        arguments: {
          action: 'flag',
          account: TEST_ACCOUNT,
          uid: sentUid
        }
      })

      expect(result.isError).toBeFalsy()
      const data = parseResult(result)
      expect(data.action).toBe('flag')
      expect(data.account).toBe(TEST_ACCOUNT)
    }, 30_000)

    it('messages.unflag -- unflag the message', async () => {
      expect(sentUid).toBeDefined()

      const result = await client.callTool({
        name: 'messages',
        arguments: {
          action: 'unflag',
          account: TEST_ACCOUNT,
          uid: sentUid
        }
      })

      expect(result.isError).toBeFalsy()
      const data = parseResult(result)
      expect(data.action).toBe('unflag')
      expect(data.account).toBe(TEST_ACCOUNT)
    }, 30_000)

    it('messages.move -- move to [Gmail]/Starred and verify', async () => {
      expect(sentUid).toBeDefined()

      // Move from INBOX to [Gmail]/Starred
      const moveResult = await client.callTool({
        name: 'messages',
        arguments: {
          action: 'move',
          account: TEST_ACCOUNT,
          uid: sentUid,
          folder: 'INBOX',
          destination: '[Gmail]/Starred'
        }
      })

      expect(moveResult.isError).toBeFalsy()
      const moveData = parseResult(moveResult)
      expect(moveData.action).toBe('move')
      expect(moveData.from_folder).toBe('INBOX')
      expect(moveData.to_folder).toBe('[Gmail]/Starred')
      expect(moveData.account).toBe(TEST_ACCOUNT)

      // After move on Gmail, UID changes. Search in All Mail (which always has it) to get new UID for cleanup.
      await waitForDelivery(2000)
      const allMailSearch = await client.callTool({
        name: 'messages',
        arguments: {
          action: 'search',
          account: TEST_ACCOUNT,
          query: `SUBJECT "${TEST_SUBJECT}"`,
          folder: '[Gmail]/All Mail',
          limit: 5
        }
      })
      const allMailData = parseResult(allMailSearch)
      const allMailMsg = allMailData.messages.find((m: any) => m.subject?.includes('[MCP-TEST-'))

      // Remove old UID from cleanup (it no longer exists in INBOX)
      const idx = testUids.indexOf(sentUid)
      if (idx >= 0) testUids.splice(idx, 1)

      // The message still exists somewhere -- we just verified move succeeded.
      // For cleanup, trash from All Mail if found.
      if (allMailMsg) {
        sentUid = allMailMsg.uid
        // Trash from All Mail
        await client.callTool({
          name: 'messages',
          arguments: {
            action: 'trash',
            account: TEST_ACCOUNT,
            uid: sentUid,
            folder: '[Gmail]/All Mail'
          }
        })
      }
    }, 60_000)

    it('messages.trash -- send a fresh email and trash it', async () => {
      const trashSubject = `[MCP-TEST-TRASH-${Date.now()}]`

      // Send a fresh email to trash
      await client.callTool({
        name: 'send',
        arguments: {
          action: 'new',
          account: TEST_ACCOUNT,
          to: TEST_ACCOUNT,
          subject: trashSubject,
          body: 'Email to be trashed'
        }
      })

      await waitForDelivery(5000)

      const searchResult = await client.callTool({
        name: 'messages',
        arguments: {
          action: 'search',
          account: TEST_ACCOUNT,
          query: `SUBJECT "${trashSubject}"`,
          folder: 'INBOX',
          limit: 5
        }
      })
      const searchData = parseResult(searchResult)
      const trashMsg = searchData.messages.find((m: any) => m.subject?.includes('MCP-TEST-TRASH-'))
      expect(trashMsg).toBeDefined()

      const result = await client.callTool({
        name: 'messages',
        arguments: {
          action: 'trash',
          account: TEST_ACCOUNT,
          uid: trashMsg.uid
        }
      })

      expect(result.isError).toBeFalsy()
      const data = parseResult(result)
      expect(data.action).toBe('trash')
      expect(data.account).toBe(TEST_ACCOUNT)
    }, 60_000)
  })

  // -------------------------------------------------------------------------
  // send.reply
  // -------------------------------------------------------------------------
  describe('send.reply', () => {
    let originalUid: number
    const replySubject = `[MCP-TEST-REPLY-${Date.now()}]`

    it('should send and reply to an email', async () => {
      // Step 1: Send original
      const sendResult = await client.callTool({
        name: 'send',
        arguments: {
          action: 'new',
          account: TEST_ACCOUNT,
          to: TEST_ACCOUNT,
          subject: replySubject,
          body: 'Original message for reply test'
        }
      })
      expect(sendResult.isError).toBeFalsy()

      await waitForDelivery(5000)

      // Step 2: Find the email
      const searchResult = await client.callTool({
        name: 'messages',
        arguments: {
          action: 'search',
          account: TEST_ACCOUNT,
          query: `SUBJECT "${replySubject}"`,
          folder: 'INBOX',
          limit: 5
        }
      })
      const searchData = parseResult(searchResult)
      const found = searchData.messages.find((m: any) => m.subject?.includes('MCP-TEST-REPLY-'))
      expect(found).toBeDefined()
      originalUid = found.uid
      testUids.push(originalUid)

      // Step 3: Reply to it
      const replyResult = await client.callTool({
        name: 'send',
        arguments: {
          action: 'reply',
          account: TEST_ACCOUNT,
          uid: originalUid,
          body: 'This is a reply to the test email'
        }
      })
      expect(replyResult.isError).toBeFalsy()
      const replyData = parseResult(replyResult)
      expect(replyData.action).toBe('reply')
      expect(replyData.success).toBe(true)
      expect(replyData.subject).toContain('Re:')
      expect(replyData.in_reply_to).toBeTruthy()

      // Cleanup: find the reply in INBOX and trash both
      await waitForDelivery(3000)
      const cleanupSearch = await client.callTool({
        name: 'messages',
        arguments: {
          action: 'search',
          account: TEST_ACCOUNT,
          query: `SUBJECT "${replySubject}"`,
          folder: 'INBOX',
          limit: 10
        }
      })
      const cleanupData = parseResult(cleanupSearch)
      for (const msg of cleanupData.messages) {
        if (msg.subject?.includes('MCP-TEST-REPLY-') && !testUids.includes(msg.uid)) {
          testUids.push(msg.uid)
        }
      }
    }, 60_000)
  })

  // -------------------------------------------------------------------------
  // send.forward
  // -------------------------------------------------------------------------
  describe('send.forward', () => {
    let originalUid: number
    const fwdSubject = `[MCP-TEST-FWD-${Date.now()}]`

    it('should send and forward an email', async () => {
      // Step 1: Send original
      const sendResult = await client.callTool({
        name: 'send',
        arguments: {
          action: 'new',
          account: TEST_ACCOUNT,
          to: TEST_ACCOUNT,
          subject: fwdSubject,
          body: 'Original message for forward test'
        }
      })
      expect(sendResult.isError).toBeFalsy()

      await waitForDelivery(5000)

      // Step 2: Find the email
      const searchResult = await client.callTool({
        name: 'messages',
        arguments: {
          action: 'search',
          account: TEST_ACCOUNT,
          query: `SUBJECT "${fwdSubject}"`,
          folder: 'INBOX',
          limit: 5
        }
      })
      const searchData = parseResult(searchResult)
      const found = searchData.messages.find((m: any) => m.subject?.includes('MCP-TEST-FWD-'))
      expect(found).toBeDefined()
      originalUid = found.uid
      testUids.push(originalUid)

      // Step 3: Forward to self
      const fwdResult = await client.callTool({
        name: 'send',
        arguments: {
          action: 'forward',
          account: TEST_ACCOUNT,
          uid: originalUid,
          to: TEST_ACCOUNT,
          body: 'Forwarding this email to you'
        }
      })
      expect(fwdResult.isError).toBeFalsy()
      const fwdData = parseResult(fwdResult)
      expect(fwdData.action).toBe('forward')
      expect(fwdData.success).toBe(true)
      expect(fwdData.subject).toContain('Fwd:')

      // Cleanup: find forwarded email too
      await waitForDelivery(3000)
      const cleanupSearch = await client.callTool({
        name: 'messages',
        arguments: {
          action: 'search',
          account: TEST_ACCOUNT,
          query: `SUBJECT "${fwdSubject}"`,
          folder: 'INBOX',
          limit: 10
        }
      })
      const cleanupData = parseResult(cleanupSearch)
      for (const msg of cleanupData.messages) {
        if (msg.subject?.includes('MCP-TEST-FWD-') && !testUids.includes(msg.uid)) {
          testUids.push(msg.uid)
        }
      }
    }, 60_000)
  })

  // -------------------------------------------------------------------------
  // attachments
  // -------------------------------------------------------------------------
  describe('attachments', () => {
    let emailUid: number
    const attSubject = `[MCP-TEST-ATT-${Date.now()}]`

    it('attachments.list -- list attachments on a sent email (no attachments expected)', async () => {
      // Send an email to self (no attachment support in send tool)
      const sendResult = await client.callTool({
        name: 'send',
        arguments: {
          action: 'new',
          account: TEST_ACCOUNT,
          to: TEST_ACCOUNT,
          subject: attSubject,
          body: 'Email for attachment list test'
        }
      })
      expect(sendResult.isError).toBeFalsy()

      await waitForDelivery(5000)

      // Find the email
      const searchResult = await client.callTool({
        name: 'messages',
        arguments: {
          action: 'search',
          account: TEST_ACCOUNT,
          query: `SUBJECT "${attSubject}"`,
          folder: 'INBOX',
          limit: 5
        }
      })
      const searchData = parseResult(searchResult)
      const found = searchData.messages.find((m: any) => m.subject?.includes('MCP-TEST-ATT-'))
      expect(found).toBeDefined()
      emailUid = found.uid
      testUids.push(emailUid)

      // List attachments
      const result = await client.callTool({
        name: 'attachments',
        arguments: {
          action: 'list',
          account: TEST_ACCOUNT,
          uid: emailUid
        }
      })

      expect(result.isError).toBeFalsy()
      const data = parseResult(result)
      expect(data.action).toBe('list')
      expect(data.account).toBe(TEST_ACCOUNT)
      expect(data.uid).toBe(emailUid)
      expect(data.total).toBe(0)
      expect(data.attachments).toEqual([])
    }, 60_000)

    it('attachments.download -- should error when no filename provided', async () => {
      expect(emailUid).toBeDefined()

      const result = await client.callTool({
        name: 'attachments',
        arguments: {
          action: 'download',
          account: TEST_ACCOUNT,
          uid: emailUid
          // No filename -- should error
        }
      })

      expect(result.isError).toBe(true)
      const text = (result.content as Array<{ type: string; text: string }>)[0]?.text
      expect(text).toContain('filename')
    }, 30_000)
  })

  // -------------------------------------------------------------------------
  // help
  // -------------------------------------------------------------------------
  describe('help', () => {
    it('should return documentation for all 5 tools', async () => {
      const toolNames = ['messages', 'folders', 'attachments', 'send', 'help']

      for (const toolName of toolNames) {
        const result = await client.callTool({
          name: 'help',
          arguments: { tool_name: toolName }
        })

        expect(result.isError).toBeFalsy()
        const text = (result.content as Array<{ type: string; text: string }>)[0]?.text
        expect(text).toBeTruthy()
        expect(text).toContain(toolName)
      }
    }, 30_000)
  })

  // -------------------------------------------------------------------------
  // multi-account (validation)
  // -------------------------------------------------------------------------
  describe('multi-account', () => {
    it('should reject operations for unconfigured account', async () => {
      const result = await client.callTool({
        name: 'messages',
        arguments: {
          action: 'search',
          account: 'nonexistent@example.com'
        }
      })

      expect(result.isError).toBe(true)
      const text = (result.content as Array<{ type: string; text: string }>)[0]?.text
      expect(text).toBeTruthy()
    }, 30_000)
  })
})
