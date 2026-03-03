import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock dependencies before importing registry
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn()
}))

vi.mock('./composite/attachments.js', () => ({ attachments: vi.fn() }))
vi.mock('./composite/folders.js', () => ({ folders: vi.fn() }))
vi.mock('./composite/messages.js', () => ({ messages: vi.fn() }))
vi.mock('./composite/send.js', () => ({ send: vi.fn() }))

import { readFile } from 'node:fs/promises'
import { attachments } from './composite/attachments.js'
import { folders } from './composite/folders.js'
import { messages } from './composite/messages.js'
import { send } from './composite/send.js'
import type { AccountConfig } from './helpers/config.js'
import { EmailMCPError } from './helpers/errors.js'
import { registerTools } from './registry.js'

describe('registerTools logic', () => {
  let mockServer: any
  let handlers: Record<string, any>
  const mockAccounts: AccountConfig[] = []

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = {}
    mockServer = {
      setRequestHandler: vi.fn((schema, handler) => {
        // Find the schema key dynamically or fallback to comparing objects.
        // The sdk exports objects for the schemas with a 'method' or similar prop.
        // Actually the `setRequestHandler` uses the object reference itself.
        // Let's store by object reference or name.
        if (schema === ListToolsRequestSchema) handlers['ListToolsRequestSchema'] = handler
        if (schema === ListResourcesRequestSchema) handlers['ListResourcesRequestSchema'] = handler
        if (schema === ReadResourceRequestSchema) handlers['ReadResourceRequestSchema'] = handler
        if (schema === CallToolRequestSchema) handlers['CallToolRequestSchema'] = handler
      })
    }
    registerTools(mockServer, mockAccounts)
  })

  describe('ListToolsRequestSchema', () => {
    it('should return a list of tools', async () => {
      const handler = handlers['ListToolsRequestSchema']
      expect(handler).toBeDefined()

      const request = {}
      const result = await handler(request)
      expect(result.tools).toBeDefined()
      expect(result.tools).toHaveLength(5)
    })
  })

  describe('ListResourcesRequestSchema', () => {
    it('should return a list of resources', async () => {
      const handler = handlers['ListResourcesRequestSchema']
      expect(handler).toBeDefined()

      const request = {}
      const result = await handler(request)
      expect(result.resources).toBeDefined()
      expect(result.resources).toHaveLength(5)
      expect(result.resources[0].uri).toBe('email://docs/messages')
    })
  })

  describe('ReadResourceRequestSchema', () => {
    it('should return content for a valid resource', async () => {
      const handler = handlers['ReadResourceRequestSchema']
      expect(handler).toBeDefined()

      vi.mocked(readFile).mockResolvedValueOnce('mock markdown content')

      const result = await handler({
        params: { uri: 'email://docs/messages' }
      })

      expect(result.contents).toBeDefined()
      expect(result.contents[0].uri).toBe('email://docs/messages')
      expect(result.contents[0].mimeType).toBe('text/markdown')
      expect(result.contents[0].text).toBe('mock markdown content')
    })

    it('should throw EmailMCPError for an invalid resource', async () => {
      const handler = handlers['ReadResourceRequestSchema']
      expect(handler).toBeDefined()

      await expect(
        handler({
          params: { uri: 'email://docs/unknown' }
        })
      ).rejects.toThrowError(EmailMCPError)
    })
  })

  describe('CallToolRequestSchema', () => {
    let callToolHandler: any

    beforeEach(() => {
      callToolHandler = handlers['CallToolRequestSchema']
      expect(callToolHandler).toBeDefined()
    })

    it('should return error when no arguments are provided', async () => {
      const request = {
        params: {
          name: 'messages',
          arguments: undefined
        }
      }

      const result = await callToolHandler(request)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Error: No arguments provided')
    })

    it('should handle unknown tool execution gracefully', async () => {
      const request = {
        params: {
          name: 'unknown_tool_name',
          arguments: {}
        }
      }

      const result = await callToolHandler(request)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Unknown tool: unknown_tool_name')
    })

    it('should dispatch messages tool successfully', async () => {
      vi.mocked(messages).mockResolvedValueOnce({ success: true } as any)

      const request = {
        params: {
          name: 'messages',
          arguments: { action: 'search' }
        }
      }

      const result = await callToolHandler(request)

      expect(messages).toHaveBeenCalledWith(mockAccounts, { action: 'search' })
      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toContain('"success": true')
    })

    it('should dispatch folders tool successfully', async () => {
      vi.mocked(folders).mockResolvedValueOnce({ success: true } as any)

      const request = {
        params: {
          name: 'folders',
          arguments: { action: 'list' }
        }
      }

      const result = await callToolHandler(request)

      expect(folders).toHaveBeenCalledWith(mockAccounts, { action: 'list' })
      expect(result.isError).toBeUndefined()
    })

    it('should dispatch attachments tool successfully', async () => {
      vi.mocked(attachments).mockResolvedValueOnce({ success: true } as any)

      const request = {
        params: {
          name: 'attachments',
          arguments: { action: 'list' }
        }
      }

      const result = await callToolHandler(request)

      expect(attachments).toHaveBeenCalledWith(mockAccounts, { action: 'list' })
      expect(result.isError).toBeUndefined()
    })

    it('should dispatch send tool successfully', async () => {
      vi.mocked(send).mockResolvedValueOnce({ success: true } as any)

      const request = {
        params: {
          name: 'send',
          arguments: { action: 'new' }
        }
      }

      const result = await callToolHandler(request)

      expect(send).toHaveBeenCalledWith(mockAccounts, { action: 'new' })
      expect(result.isError).toBeUndefined()
    })

    it('should handle help tool request correctly', async () => {
      vi.mocked(readFile).mockResolvedValueOnce('mock help markdown')

      const request = {
        params: {
          name: 'help',
          arguments: { tool_name: 'messages' }
        }
      }

      const result = await callToolHandler(request)

      expect(result.isError).toBeUndefined()
      // The wrapped json result
      expect(result.content[0].text).toContain('mock help markdown')
    })

    it('should handle help tool missing documentation correctly', async () => {
      vi.mocked(readFile).mockRejectedValueOnce(new Error('File not found'))

      const request = {
        params: {
          name: 'help',
          arguments: { tool_name: 'nonexistent-tool' }
        }
      }

      const result = await callToolHandler(request)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Documentation not found for: nonexistent-tool')
    })

    it('should catch and wrap unexpected errors during execution', async () => {
      vi.mocked(messages).mockRejectedValueOnce(new Error('Unexpected disaster'))

      const request = {
        params: {
          name: 'messages',
          arguments: { action: 'search' }
        }
      }

      const result = await callToolHandler(request)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Unexpected disaster')
    })
  })
})
