import { readFile } from 'node:fs/promises'
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { attachments } from './composite/attachments.js'
import { folders } from './composite/folders.js'
import { messages } from './composite/messages.js'
import { send } from './composite/send.js'
import { registerTools } from './registry.js'

// Mock dependencies
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn()
}))

vi.mock('./composite/attachments.js', () => ({ attachments: vi.fn() }))
vi.mock('./composite/folders.js', () => ({ folders: vi.fn() }))
vi.mock('./composite/messages.js', () => ({ messages: vi.fn() }))
vi.mock('./composite/send.js', () => ({ send: vi.fn() }))

describe('registerTools logic tests', () => {
  let mockServer: any
  let handlers: Map<any, any>
  let mockAccounts: any[]

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = new Map()
    mockAccounts = [{ email: 'test@example.com' }]
    mockServer = {
      setRequestHandler: vi.fn((schema, handler) => {
        handlers.set(schema, handler)
      })
    }

    registerTools(mockServer, mockAccounts)
  })

  describe('ListToolsRequestSchema handler', () => {
    it('should return the list of tools', async () => {
      const handler = handlers.get(ListToolsRequestSchema)
      expect(handler).toBeDefined()

      const result = await handler({})
      expect(result).toHaveProperty('tools')
      expect(Array.isArray(result.tools)).toBe(true)
      expect(result.tools.length).toBe(5)
      expect(result.tools.map((t: any) => t.name)).toEqual([
        'messages', 'folders', 'attachments', 'send', 'help'
      ])
    })
  })

  describe('ListResourcesRequestSchema handler', () => {
    it('should return the list of resources', async () => {
      const handler = handlers.get(ListResourcesRequestSchema)
      expect(handler).toBeDefined()

      const result = await handler({})
      expect(result).toHaveProperty('resources')
      expect(Array.isArray(result.resources)).toBe(true)
      expect(result.resources.length).toBeGreaterThan(0)

      const expectedUris = [
        'email://docs/messages',
        'email://docs/folders',
        'email://docs/attachments',
        'email://docs/send',
        'email://docs/help'
      ]

      const uris = result.resources.map((r: any) => r.uri)
      for (const uri of expectedUris) {
        expect(uris).toContain(uri)
      }

      expect(result.resources[0].mimeType).toBe('text/markdown')
    })
  })

  describe('ReadResourceRequestSchema handler', () => {
    it('should return resource content for a valid URI', async () => {
      const handler = handlers.get(ReadResourceRequestSchema)
      expect(handler).toBeDefined()

      const mockContent = '# Messages Tool Docs\nSome documentation.'
      vi.mocked(readFile).mockResolvedValueOnce(mockContent)

      const request = { params: { uri: 'email://docs/messages' } }
      const result = await handler(request)

      expect(result).toHaveProperty('contents')
      expect(result.contents.length).toBe(1)
      expect(result.contents[0].uri).toBe('email://docs/messages')
      expect(result.contents[0].mimeType).toBe('text/markdown')
      expect(result.contents[0].text).toBe(mockContent)
      expect(readFile).toHaveBeenCalledTimes(1)
    })

    it('should throw an error for an invalid URI', async () => {
      const handler = handlers.get(ReadResourceRequestSchema)
      expect(handler).toBeDefined()

      const request = { params: { uri: 'email://docs/invalid' } }

      await expect(handler(request)).rejects.toThrow('Resource not found: email://docs/invalid')
    })
  })

  describe('CallToolRequestSchema handler', () => {
    it('should return error when no arguments are provided', async () => {
      const handler = handlers.get(CallToolRequestSchema)
      expect(handler).toBeDefined()

      const request = { params: { name: 'messages', arguments: undefined } }
      const result = await handler(request)

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Error: No arguments provided' }],
        isError: true
      })
    })

    it('should handle messages tool execution', async () => {
      const handler = handlers.get(CallToolRequestSchema)
      const mockResult = { success: true }
      vi.mocked(messages).mockResolvedValueOnce(mockResult as any)

      const request = { params: { name: 'messages', arguments: { action: 'search' } } }
      const result = await handler(request)

      expect(messages).toHaveBeenCalledWith(mockAccounts, { action: 'search' })
      expect(result.content[0].text).toContain(JSON.stringify(mockResult, null, 2))
    })

    it('should handle folders tool execution', async () => {
      const handler = handlers.get(CallToolRequestSchema)
      const mockResult = { success: true }
      vi.mocked(folders).mockResolvedValueOnce(mockResult as any)

      const request = { params: { name: 'folders', arguments: { action: 'list' } } }
      const result = await handler(request)

      expect(folders).toHaveBeenCalledWith(mockAccounts, { action: 'list' })
      expect(result.content[0].text).toContain(JSON.stringify(mockResult, null, 2))
    })

    it('should handle attachments tool execution', async () => {
      const handler = handlers.get(CallToolRequestSchema)
      const mockResult = { success: true }
      vi.mocked(attachments).mockResolvedValueOnce(mockResult as any)

      const request = { params: { name: 'attachments', arguments: { action: 'list', account: 'test@example.com', uid: 1 } } }
      const result = await handler(request)

      expect(attachments).toHaveBeenCalledWith(mockAccounts, { action: 'list', account: 'test@example.com', uid: 1 })
      expect(result.content[0].text).toContain(JSON.stringify(mockResult, null, 2))
    })

    it('should handle send tool execution', async () => {
      const handler = handlers.get(CallToolRequestSchema)
      const mockResult = { success: true }
      vi.mocked(send).mockResolvedValueOnce(mockResult as any)

      const request = { params: { name: 'send', arguments: { action: 'new', account: 'test@example.com', to: 'test2@example.com', body: 'Test' } } }
      const result = await handler(request)

      expect(send).toHaveBeenCalledWith(mockAccounts, { action: 'new', account: 'test@example.com', to: 'test2@example.com', body: 'Test' })
      expect(result.content[0].text).toContain(JSON.stringify(mockResult, null, 2))
    })

    it('should handle help tool execution', async () => {
      const handler = handlers.get(CallToolRequestSchema)
      const mockContent = 'Mock Help Doc'
      vi.mocked(readFile).mockResolvedValueOnce(mockContent)

      const request = { params: { name: 'help', arguments: { tool_name: 'messages' } } }
      const result = await handler(request)

      expect(readFile).toHaveBeenCalled()
      expect(result.content[0].text).toContain(mockContent)
    })

    it('should handle help tool execution error', async () => {
      const handler = handlers.get(CallToolRequestSchema)
      vi.mocked(readFile).mockRejectedValueOnce(new Error('File not found'))

      const request = { params: { name: 'help', arguments: { tool_name: 'unknown_tool' } } }
      const result = await handler(request)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Documentation not found for: unknown_tool')
    })

    it('should handle unknown tool gracefully', async () => {
      const handler = handlers.get(CallToolRequestSchema)

      const request = { params: { name: 'unknown', arguments: {} } }
      const result = await handler(request)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Unknown tool: unknown')
    })

    it('should handle tool throwing error gracefully', async () => {
      const handler = handlers.get(CallToolRequestSchema)
      vi.mocked(messages).mockRejectedValueOnce(new Error('Tool error'))

      const request = { params: { name: 'messages', arguments: { action: 'search' } } }
      const result = await handler(request)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Tool error')
    })
  })
})
