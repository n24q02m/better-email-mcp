import { readFile } from 'node:fs/promises'
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerTools } from './registry.js'

// Mock dependencies
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn()
}))

vi.mock('./composite/attachments.js', () => ({ attachments: vi.fn() }))
vi.mock('./composite/folders.js', () => ({ folders: vi.fn() }))
vi.mock('./composite/messages.js', () => ({ messages: vi.fn() }))
vi.mock('./composite/send.js', () => ({ send: vi.fn() }))

describe('registerTools', () => {
  let mockServer: any
  let handlers: Map<any, Function>

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = new Map()
    mockServer = {
      setRequestHandler: vi.fn((schema, handler) => {
        handlers.set(schema, handler)
      })
    }
  })

  it('should return error when no arguments are provided', async () => {
    const accounts = [] as any
    registerTools(mockServer, accounts)

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

  it('should register ListToolsRequestSchema and return tools', async () => {
    registerTools(mockServer, [])

    const listToolsHandler = handlers.get(ListToolsRequestSchema)
    expect(listToolsHandler).toBeDefined()

    const result = await listToolsHandler!()
    expect(result).toHaveProperty('tools')
    expect(Array.isArray(result.tools)).toBe(true)
    expect(result.tools).toHaveLength(5)
  })

  it('should register ListResourcesRequestSchema and return resources', async () => {
    registerTools(mockServer, [])

    const listResourcesHandler = handlers.get(ListResourcesRequestSchema)
    expect(listResourcesHandler).toBeDefined()

    const result = await listResourcesHandler!()
    expect(result).toHaveProperty('resources')
    expect(Array.isArray(result.resources)).toBe(true)
    expect(result.resources).toHaveLength(5)
    expect(result.resources[0].mimeType).toBe('text/markdown')
  })

  it('should register ReadResourceRequestSchema and read valid resources', async () => {
    registerTools(mockServer, [])

    const readResourceHandler = handlers.get(ReadResourceRequestSchema)
    expect(readResourceHandler).toBeDefined()

    vi.mocked(readFile).mockResolvedValueOnce('mocked markdown content')

    const request = {
      params: {
        uri: 'email://docs/messages'
      }
    }

    const result = await readResourceHandler!(request)

    expect(readFile).toHaveBeenCalledTimes(1)
    expect(result).toHaveProperty('contents')
    expect(result.contents).toHaveLength(1)
    expect(result.contents[0].uri).toBe('email://docs/messages')
    expect(result.contents[0].mimeType).toBe('text/markdown')
    expect(result.contents[0].text).toBe('mocked markdown content')
  })

  it('should throw an error for invalid resources in ReadResourceRequestSchema', async () => {
    registerTools(mockServer, [])

    const readResourceHandler = handlers.get(ReadResourceRequestSchema)
    expect(readResourceHandler).toBeDefined()

    const request = {
      params: {
        uri: 'email://docs/invalid-resource'
      }
    }

    await expect(readResourceHandler!(request)).rejects.toThrow('Resource not found: email://docs/invalid-resource')
  })

  describe('CallToolRequestSchema tools', () => {
    it('should call messages tool', async () => {
      registerTools(mockServer, [])
      const callToolHandler = handlers.get(CallToolRequestSchema)

      const { messages } = await import('./composite/messages.js')
      vi.mocked(messages).mockResolvedValueOnce({ success: true, from: 'messages' })

      const request = {
        params: {
          name: 'messages',
          arguments: { action: 'search' }
        }
      }

      const result = await callToolHandler!(request)
      expect(messages).toHaveBeenCalledWith([], { action: 'search' })
      expect(result.content[0].text).toContain('messages')
    })

    it('should call folders tool', async () => {
      registerTools(mockServer, [])
      const callToolHandler = handlers.get(CallToolRequestSchema)

      const { folders } = await import('./composite/folders.js')
      vi.mocked(folders).mockResolvedValueOnce({ success: true, from: 'folders' })

      const request = {
        params: {
          name: 'folders',
          arguments: { action: 'list' }
        }
      }

      const result = await callToolHandler!(request)
      expect(folders).toHaveBeenCalledWith([], { action: 'list' })
      expect(result.content[0].text).toContain('folders')
    })

    it('should call attachments tool', async () => {
      registerTools(mockServer, [])
      const callToolHandler = handlers.get(CallToolRequestSchema)

      const { attachments } = await import('./composite/attachments.js')
      vi.mocked(attachments).mockResolvedValueOnce({ success: true, from: 'attachments' })

      const request = {
        params: {
          name: 'attachments',
          arguments: { action: 'list', account: 'test@example.com', uid: 1 }
        }
      }

      const result = await callToolHandler!(request)
      expect(attachments).toHaveBeenCalledWith([], { action: 'list', account: 'test@example.com', uid: 1 })
      expect(result.content[0].text).toContain('attachments')
    })

    it('should call send tool', async () => {
      registerTools(mockServer, [])
      const callToolHandler = handlers.get(CallToolRequestSchema)

      const { send } = await import('./composite/send.js')
      vi.mocked(send).mockResolvedValueOnce({ success: true, from: 'send' })

      const request = {
        params: {
          name: 'send',
          arguments: { action: 'new', account: 'test@example.com', to: 'test2@example.com', body: 'body' }
        }
      }

      const result = await callToolHandler!(request)
      expect(send).toHaveBeenCalledWith([], {
        action: 'new',
        account: 'test@example.com',
        to: 'test2@example.com',
        body: 'body'
      })
      expect(result.content[0].text).toContain('send')
    })

    it('should call help tool with valid tool_name', async () => {
      registerTools(mockServer, [])
      const callToolHandler = handlers.get(CallToolRequestSchema)

      vi.mocked(readFile).mockResolvedValueOnce('mocked help content')

      const request = {
        params: {
          name: 'help',
          arguments: { tool_name: 'messages' }
        }
      }

      const result = await callToolHandler!(request)
      expect(readFile).toHaveBeenCalledTimes(1)
      expect(result.content[0].text).toContain('mocked help content')
    })
  })
})
