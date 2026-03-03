import { readFile } from 'node:fs/promises'
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// 1. Mock fs/promises
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn()
}))

// 2. Mock composite tools
vi.mock('./composite/attachments.js', () => ({ attachments: vi.fn() }))
vi.mock('./composite/folders.js', () => ({ folders: vi.fn() }))
vi.mock('./composite/messages.js', () => ({ messages: vi.fn() }))
vi.mock('./composite/send.js', () => ({ send: vi.fn() }))

// 3. Import dependencies
import { attachments } from './composite/attachments.js'
import { folders } from './composite/folders.js'
import { messages } from './composite/messages.js'
import { send } from './composite/send.js'
import type { AccountConfig } from './helpers/config.js'
import { EmailMCPError } from './helpers/errors.js'
import { wrapToolResult } from './helpers/security.js'
import { registerTools } from './registry.js'

describe('registerTools', () => {
  let mockServer: any
  let handlers: Map<any, Function>
  let mockAccounts: AccountConfig[]

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = new Map()
    mockAccounts = [
      {
        id: 'test',
        email: 'test@example.com',
        password: 'password',
        imap: { host: 'imap.example.com', port: 993, secure: true },
        smtp: { host: 'smtp.example.com', port: 465, secure: true }
      }
    ]

    mockServer = {
      setRequestHandler: vi.fn((schema, handler) => {
        handlers.set(schema, handler)
      })
    }
  })

  it('should return error when no arguments are provided to CallToolRequestSchema', async () => {
    registerTools(mockServer, mockAccounts)

    const callToolHandler = handlers.get(CallToolRequestSchema)
    expect(callToolHandler).toBeDefined()

    const request = {
      params: {
        name: 'messages',
        arguments: undefined
      }
    }

    const result = await callToolHandler!(request)

    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: 'Error: No arguments provided'
        }
      ],
      isError: true
    })
  })

  describe('ListToolsRequestSchema', () => {
    it('should return the expected tools list', async () => {
      registerTools(mockServer, mockAccounts)
      const listToolsHandler = handlers.get(ListToolsRequestSchema)
      expect(listToolsHandler).toBeDefined()

      const result = await listToolsHandler!({})
      expect(result).toHaveProperty('tools')
      expect(Array.isArray(result.tools)).toBe(true)
      expect(result.tools).toHaveLength(5)

      const names = result.tools.map((t: any) => t.name)
      expect(names).toEqual(['messages', 'folders', 'attachments', 'send', 'help'])
    })
  })

  describe('ListResourcesRequestSchema', () => {
    it('should return the expected resources list', async () => {
      registerTools(mockServer, mockAccounts)
      const listResourcesHandler = handlers.get(ListResourcesRequestSchema)
      expect(listResourcesHandler).toBeDefined()

      const result = await listResourcesHandler!({})
      expect(result).toHaveProperty('resources')
      expect(Array.isArray(result.resources)).toBe(true)
      expect(result.resources).toHaveLength(5)

      const uris = result.resources.map((r: any) => r.uri)
      expect(uris).toContain('email://docs/messages')
      expect(uris).toContain('email://docs/folders')
      expect(uris).toContain('email://docs/attachments')
      expect(uris).toContain('email://docs/send')
      expect(uris).toContain('email://docs/help')
    })
  })

  describe('ReadResourceRequestSchema', () => {
    it('should return file content for a valid resource', async () => {
      registerTools(mockServer, mockAccounts)
      const readResourceHandler = handlers.get(ReadResourceRequestSchema)
      expect(readResourceHandler).toBeDefined()

      vi.mocked(readFile).mockResolvedValueOnce('# Messages Tool Docs\nSome content')

      const result = await readResourceHandler!({
        params: { uri: 'email://docs/messages' }
      })

      expect(result).toHaveProperty('contents')
      expect(result.contents).toHaveLength(1)
      expect(result.contents[0].uri).toBe('email://docs/messages')
      expect(result.contents[0].mimeType).toBe('text/markdown')
      expect(result.contents[0].text).toBe('# Messages Tool Docs\nSome content')
      expect(readFile).toHaveBeenCalledTimes(1)
    })

    it('should throw an error for an invalid resource', async () => {
      registerTools(mockServer, mockAccounts)
      const readResourceHandler = handlers.get(ReadResourceRequestSchema)
      expect(readResourceHandler).toBeDefined()

      await expect(readResourceHandler!({ params: { uri: 'email://docs/invalid' } })).rejects.toThrow(EmailMCPError)
    })
  })

  describe('CallToolRequestSchema - success paths', () => {
    it('should route "messages" tool correctly', async () => {
      registerTools(mockServer, mockAccounts)
      const callToolHandler = handlers.get(CallToolRequestSchema)
      const mockResult = { items: [] }
      vi.mocked(messages).mockResolvedValueOnce(mockResult as any)

      const result = await callToolHandler!({
        params: { name: 'messages', arguments: { action: 'search' } }
      })

      expect(messages).toHaveBeenCalledWith(mockAccounts, { action: 'search' })
      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toContain(JSON.stringify(mockResult, null, 2))
    })

    it('should route "folders" tool correctly', async () => {
      registerTools(mockServer, mockAccounts)
      const callToolHandler = handlers.get(CallToolRequestSchema)
      const mockResult = { folders: [] }
      vi.mocked(folders).mockResolvedValueOnce(mockResult as any)

      const result = await callToolHandler!({
        params: { name: 'folders', arguments: { action: 'list' } }
      })

      expect(folders).toHaveBeenCalledWith(mockAccounts, { action: 'list' })
      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toContain(JSON.stringify(mockResult, null, 2))
    })

    it('should route "attachments" tool correctly', async () => {
      registerTools(mockServer, mockAccounts)
      const callToolHandler = handlers.get(CallToolRequestSchema)
      const mockResult = { attachments: [] }
      vi.mocked(attachments).mockResolvedValueOnce(mockResult as any)

      const result = await callToolHandler!({
        params: { name: 'attachments', arguments: { action: 'list' } }
      })

      expect(attachments).toHaveBeenCalledWith(mockAccounts, { action: 'list' })
      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toContain(JSON.stringify(mockResult, null, 2))
    })

    it('should route "send" tool correctly', async () => {
      registerTools(mockServer, mockAccounts)
      const callToolHandler = handlers.get(CallToolRequestSchema)
      const mockResult = { success: true }
      vi.mocked(send).mockResolvedValueOnce(mockResult as any)

      const result = await callToolHandler!({
        params: { name: 'send', arguments: { action: 'new' } }
      })

      expect(send).toHaveBeenCalledWith(mockAccounts, { action: 'new' })
      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toContain(JSON.stringify(mockResult, null, 2))
    })

    it('should handle "help" tool correctly', async () => {
      registerTools(mockServer, mockAccounts)
      const callToolHandler = handlers.get(CallToolRequestSchema)

      const helpContent = '# Help Docs'
      vi.mocked(readFile).mockResolvedValueOnce(helpContent)

      const result = await callToolHandler!({
        params: { name: 'help', arguments: { tool_name: 'send' } }
      })

      expect(readFile).toHaveBeenCalledTimes(1)
      const expectedResult = { tool: 'send', documentation: helpContent }
      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toContain(JSON.stringify(expectedResult, null, 2))
    })
  })

  describe('CallToolRequestSchema - error paths', () => {
    it('should catch and format generic errors correctly', async () => {
      registerTools(mockServer, mockAccounts)
      const callToolHandler = handlers.get(CallToolRequestSchema)

      const errorMessage = 'Something went wrong!'
      vi.mocked(messages).mockRejectedValueOnce(new Error(errorMessage))

      const result = await callToolHandler!({
        params: { name: 'messages', arguments: { action: 'search' } }
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].type).toBe('text')
      expect(result.content[0].text).toContain(errorMessage)
    })

    it('should catch and format EmailMCPError correctly', async () => {
      registerTools(mockServer, mockAccounts)
      const callToolHandler = handlers.get(CallToolRequestSchema)

      const customError = new EmailMCPError('Custom issue', 'CUSTOM_ERR', 'Try again later')
      vi.mocked(folders).mockRejectedValueOnce(customError)

      const result = await callToolHandler!({
        params: { name: 'folders', arguments: { action: 'list' } }
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Custom issue')
      expect(result.content[0].text).toContain('Try again later')
    })

    it('should handle "help" documentation not found', async () => {
      registerTools(mockServer, mockAccounts)
      const callToolHandler = handlers.get(CallToolRequestSchema)

      vi.mocked(readFile).mockRejectedValueOnce(new Error('File not found'))

      const result = await callToolHandler!({
        params: { name: 'help', arguments: { tool_name: 'nonexistent' } }
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Documentation not found for: nonexistent')
      expect(result.content[0].text).toContain('Check tool_name')
    })
  })
})
