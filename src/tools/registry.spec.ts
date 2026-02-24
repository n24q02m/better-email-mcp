import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { registerTools } from './registry.js'
import { EmailMCPError } from './helpers/errors.js'
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js'

// Mock dependencies
vi.mock('node:fs', () => ({
  readFileSync: vi.fn()
}))

vi.mock('./composite/messages.js', () => ({
  messages: vi.fn()
}))
vi.mock('./composite/folders.js', () => ({
  folders: vi.fn()
}))
vi.mock('./composite/attachments.js', () => ({
  attachments: vi.fn()
}))
vi.mock('./composite/send.js', () => ({
  send: vi.fn()
}))

// Import mocks to configure them in tests
import { readFileSync } from 'node:fs'
import { messages } from './composite/messages.js'
import { folders } from './composite/folders.js'
import { attachments } from './composite/attachments.js'
import { send } from './composite/send.js'

describe('registerTools', () => {
  let serverMock: any

  beforeEach(() => {
    serverMock = {
      setRequestHandler: vi.fn()
    }
    vi.clearAllMocks()
  })

  // Helper to get the registered handler for a schema
  const getHandler = (schema: any) => {
    const call = serverMock.setRequestHandler.mock.calls.find((call: any[]) => call[0] === schema)
    return call ? call[1] : undefined
  }

  const accounts: any[] = [{ name: 'test', config: {} }]

  it('registers all required handlers', () => {
    registerTools(serverMock, accounts)

    expect(serverMock.setRequestHandler).toHaveBeenCalledWith(ListToolsRequestSchema, expect.any(Function))
    expect(serverMock.setRequestHandler).toHaveBeenCalledWith(ListResourcesRequestSchema, expect.any(Function))
    expect(serverMock.setRequestHandler).toHaveBeenCalledWith(ReadResourceRequestSchema, expect.any(Function))
    expect(serverMock.setRequestHandler).toHaveBeenCalledWith(CallToolRequestSchema, expect.any(Function))
  })

  describe('ListToolsRequestSchema handler', () => {
    it('returns the list of tools', async () => {
      registerTools(serverMock, accounts)
      const handler = getHandler(ListToolsRequestSchema)
      const result = await handler()

      expect(result).toHaveProperty('tools')
      expect(result.tools).toHaveLength(5)
      const toolNames = result.tools.map((t: any) => t.name)
      expect(toolNames).toEqual(expect.arrayContaining(['messages', 'folders', 'attachments', 'send', 'help']))
    })
  })

  describe('ListResourcesRequestSchema handler', () => {
    it('returns the list of resources', async () => {
      registerTools(serverMock, accounts)
      const handler = getHandler(ListResourcesRequestSchema)
      const result = await handler()

      expect(result).toHaveProperty('resources')
      expect(result.resources).toHaveLength(4)
      const resourceNames = result.resources.map((r: any) => r.name)
      expect(resourceNames).toEqual(expect.arrayContaining([
        'Messages Tool Docs',
        'Folders Tool Docs',
        'Attachments Tool Docs',
        'Send Tool Docs'
      ]))
    })
  })

  describe('ReadResourceRequestSchema handler', () => {
    it('reads a valid resource', async () => {
      registerTools(serverMock, accounts);
      (readFileSync as any).mockReturnValue('Mocked Content')

      const handler = getHandler(ReadResourceRequestSchema)
      const result = await handler({ params: { uri: 'email://docs/messages' } })

      expect(readFileSync).toHaveBeenCalled()
      expect(result.contents[0].text).toBe('Mocked Content')
      expect(result.contents[0].uri).toBe('email://docs/messages')
    })

    it('throws error for invalid resource', async () => {
      registerTools(serverMock, accounts)
      const handler = getHandler(ReadResourceRequestSchema)

      await expect(handler({ params: { uri: 'email://docs/invalid' } }))
        .rejects.toThrow(EmailMCPError)
    })
  })

  describe('CallToolRequestSchema handler', () => {
    it('calls messages tool', async () => {
      registerTools(serverMock, accounts);
      (messages as any).mockResolvedValue({ some: 'result' })

      const handler = getHandler(CallToolRequestSchema)
      const result = await handler({ params: { name: 'messages', arguments: { action: 'search' } } })

      expect(messages).toHaveBeenCalledWith(accounts, { action: 'search' })
      expect(JSON.parse(result.content[0].text)).toEqual({ some: 'result' })
    })

    it('calls folders tool', async () => {
      registerTools(serverMock, accounts);
      (folders as any).mockResolvedValue(['folder1'])

      const handler = getHandler(CallToolRequestSchema)
      const result = await handler({ params: { name: 'folders', arguments: { action: 'list' } } })

      expect(folders).toHaveBeenCalledWith(accounts, { action: 'list' })
      expect(JSON.parse(result.content[0].text)).toEqual(['folder1'])
    })

    it('calls attachments tool', async () => {
      registerTools(serverMock, accounts);
      (attachments as any).mockResolvedValue({ file: 'data' })

      const handler = getHandler(CallToolRequestSchema)
      const result = await handler({ params: { name: 'attachments', arguments: { action: 'list', account: 'test', uid: 123 } } })

      expect(attachments).toHaveBeenCalledWith(accounts, { action: 'list', account: 'test', uid: 123 })
      expect(JSON.parse(result.content[0].text)).toEqual({ file: 'data' })
    })

    it('calls send tool', async () => {
      registerTools(serverMock, accounts);
      (send as any).mockResolvedValue({ sent: true })

      const handler = getHandler(CallToolRequestSchema)
      const result = await handler({ params: { name: 'send', arguments: { action: 'new', to: 'test@test.com', body: 'hi' } } })

      expect(send).toHaveBeenCalledWith(accounts, { action: 'new', to: 'test@test.com', body: 'hi' })
      expect(JSON.parse(result.content[0].text)).toEqual({ sent: true })
    })

    it('calls help tool', async () => {
      registerTools(serverMock, accounts);
      (readFileSync as any).mockReturnValue('Help Content')

      const handler = getHandler(CallToolRequestSchema)
      const result = await handler({ params: { name: 'help', arguments: { tool_name: 'messages' } } })

      expect(readFileSync).toHaveBeenCalled()
      expect(JSON.parse(result.content[0].text)).toEqual({ tool: 'messages', documentation: 'Help Content' })
    })

    it('handles help tool with invalid tool name (fs error)', async () => {
      registerTools(serverMock, accounts);
      (readFileSync as any).mockImplementation(() => { throw new Error('File not found') })

      const handler = getHandler(CallToolRequestSchema)
      const result = await handler({ params: { name: 'help', arguments: { tool_name: 'invalid' } } })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Documentation not found for: invalid')
    })

    it('handles unknown tool', async () => {
      registerTools(serverMock, accounts)
      const handler = getHandler(CallToolRequestSchema)

      const result = await handler({ params: { name: 'unknown', arguments: {} } })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Unknown tool: unknown')
    })

    it('handles missing arguments', async () => {
      registerTools(serverMock, accounts)
      const handler = getHandler(CallToolRequestSchema)

      const result = await handler({ params: { name: 'messages' } }) // missing arguments

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Error: No arguments provided')
    })

    it('handles tool execution errors', async () => {
      registerTools(serverMock, accounts);
      (messages as any).mockRejectedValue(new Error('Tool failed'))

      const handler = getHandler(CallToolRequestSchema)
      const result = await handler({ params: { name: 'messages', arguments: { action: 'search' } } })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Tool failed')
    })
  })
})
