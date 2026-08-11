import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { afterEach, describe, expect, it } from 'vitest'

const EXPECTED_TOOLS = ['messages', 'folders', 'attachments', 'config', 'config__open_relay', 'help']
const EXPECTED_RESOURCES = [
  'email://docs/messages',
  'email://docs/folders',
  'email://docs/attachments',
  'email://docs/help',
  'email://docs/config'
]
const EXPECTED_MESSAGE_ACTIONS = [
  'search',
  'read',
  'mark_read',
  'mark_unread',
  'flag',
  'unflag',
  'move',
  'archive',
  'trash',
  'new',
  'reply',
  'forward'
]
const EXPECTED_HELP_TOPICS = ['messages', 'folders', 'attachments', 'config', 'help']
const MCP_PROTOCOL_TEST_TIMEOUT_MS = 15_000

describe('public MCP tool surface', { timeout: MCP_PROTOCOL_TEST_TIMEOUT_MS }, () => {
  let client: Client | undefined

  afterEach(async () => {
    await client?.close()
    client = undefined
  })

  async function connectServer() {
    const transport = new StdioClientTransport({
      command: 'node',
      args: ['bin/cli.mjs'],
      env: {
        ...process.env,
        EMAIL_CREDENTIALS: 'test@gmail.com:fake_password',
        NODE_ENV: 'test'
      },
      stderr: 'pipe'
    })
    client = new Client({ name: 'better-email-mcp-test-client', version: '0.0.0' })
    await client.connect(transport)
    return client
  }

  it('exposes exactly the approved tools and merged messages actions through tools/list', async () => {
    const connectedClient = await connectServer()
    const result = await connectedClient.listTools()
    const tools = result.tools.map((tool) => tool.name)

    expect(tools).toEqual(EXPECTED_TOOLS)
    expect(tools).not.toContain('send')

    const messages = result.tools.find((tool) => tool.name === 'messages')
    expect(messages?.inputSchema.properties?.action).toMatchObject({ enum: EXPECTED_MESSAGE_ACTIONS })
  })

  it('exposes only current documentation resources and help topics', async () => {
    const connectedClient = await connectServer()
    const resources = await connectedClient.listResources()
    const help = (await connectedClient.listTools()).tools.find((tool) => tool.name === 'help')

    expect(resources.resources.map((resource) => resource.uri)).toEqual(EXPECTED_RESOURCES)
    expect(help?.inputSchema.properties?.tool_name).toMatchObject({ enum: EXPECTED_HELP_TOPICS })
    expect(EXPECTED_HELP_TOPICS).not.toContain('send')
  })

  it('documents outbound actions under messages and does not keep a send alias', async () => {
    const connectedClient = await connectServer()
    const helpResult = await connectedClient.callTool({
      name: 'help',
      arguments: { tool_name: 'messages' }
    })
    const helpText = (helpResult.content as Array<{ type: string; text: string }>)[0]?.text ?? ''

    expect(helpResult.isError).toBeFalsy()
    expect(helpText).toContain('### new')
    expect(helpText).toContain('### reply')
    expect(helpText).toContain('### forward')

    const oldToolCall = await connectedClient.callTool({
      name: 'send',
      arguments: { action: 'new', account: 'test@example.com', to: 'recipient@example.com', body: 'test' }
    })
    const oldHelpCall = await connectedClient.callTool({
      name: 'help',
      arguments: { tool_name: 'send' }
    })

    expect(oldToolCall.isError).toBe(true)
    expect(oldHelpCall.isError).toBe(true)
  })
})
