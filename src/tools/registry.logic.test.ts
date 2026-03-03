import { readFile } from 'node:fs/promises'
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock dependencies
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn()
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

import { attachments } from './composite/attachments.js'
import { folders } from './composite/folders.js'
import { messages } from './composite/messages.js'
import { send } from './composite/send.js'
import type { AccountConfig } from './helpers/config.js'
import { EmailMCPError } from './helpers/errors.js'
import { registerTools } from './registry.js'

describe('registerTools logic', () => {
  let mockServer: any
  let accounts: AccountConfig[]

  const getHandler = (schema: any) => {
    const call = mockServer.setRequestHandler.mock.calls.find((c: any) => c[0] === schema)
    return call ? call[1] : undefined
  }

  beforeEach(() => {
    vi.clearAllMocks()

    mockServer = {
      setRequestHandler: vi.fn()
    }
    accounts = [{ name: 'test', type: 'gmail' }] as any

    registerTools(mockServer, accounts)
  })

  describe('ListToolsRequestSchema', () => {
    it('should return the expected tools', async () => {
      const handler = getHandler(ListToolsRequestSchema)
      expect(handler).toBeDefined()

      const result = await handler({ params: {} })
      expect(result.tools).toBeDefined()
      expect(Array.isArray(result.tools)).toBe(true)
      expect(result.tools.length).toBeGreaterThan(0)
    })
  })

  describe('ListResourcesRequestSchema', () => {
    it('should return the expected resources', async () => {
      const handler = getHandler(ListResourcesRequestSchema)
      expect(handler).toBeDefined()

      const result = await handler({ params: {} })
      expect(result.resources).toBeDefined()
      expect(Array.isArray(result.resources)).toBe(true)
      expect(result.resources.length).toBeGreaterThan(0)
    })
  })

  describe('ReadResourceRequestSchema', () => {
    it('should read the file and return its content when the resource is found', async () => {
      const handler = getHandler(ReadResourceRequestSchema)
      vi.mocked(readFile).mockResolvedValueOnce('mock markdown content')

      const result = await handler({ params: { uri: 'email://docs/messages' } })

      expect(readFile).toHaveBeenCalledTimes(1)
      expect(result).toEqual({
        contents: [
          {
            uri: 'email://docs/messages',
            mimeType: 'text/markdown',
            text: 'mock markdown content'
          }
        ]
      })
    })

    it('should throw an EmailMCPError when the resource is not found', async () => {
      const handler = getHandler(ReadResourceRequestSchema)

      await expect(handler({ params: { uri: 'email://docs/not-found' } })).rejects.toThrowError(EmailMCPError)
      await expect(handler({ params: { uri: 'email://docs/not-found' } })).rejects.toThrowError(
        'Resource not found: email://docs/not-found'
      )
    })
  })

  describe('CallToolRequestSchema', () => {
    let handler: any

    beforeEach(() => {
      handler = getHandler(CallToolRequestSchema)
    })

    it('should return error when no arguments are provided', async () => {
      const request = { params: { name: 'messages', arguments: undefined } }
      const result = await handler(request)

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Error: No arguments provided' }],
        isError: true
      })
    })

    it('should call messages tool', async () => {
      const mockResult = { status: 'success' }
      vi.mocked(messages).mockResolvedValueOnce(mockResult as any)

      const request = { params: { name: 'messages', arguments: { action: 'search' } } }
      const result = await handler(request)

      expect(messages).toHaveBeenCalledWith(accounts, { action: 'search' })
      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toContain(JSON.stringify(mockResult, null, 2))
    })

    it('should call folders tool', async () => {
      const mockResult = { status: 'success' }
      vi.mocked(folders).mockResolvedValueOnce(mockResult as any)

      const request = { params: { name: 'folders', arguments: { action: 'list' } } }
      const result = await handler(request)

      expect(folders).toHaveBeenCalledWith(accounts, { action: 'list' })
      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toContain(JSON.stringify(mockResult, null, 2))
    })

    it('should call attachments tool', async () => {
      const mockResult = { status: 'success' }
      vi.mocked(attachments).mockResolvedValueOnce(mockResult as any)

      const request = { params: { name: 'attachments', arguments: { action: 'list', uid: 1, account: 'test' } } }
      const result = await handler(request)

      expect(attachments).toHaveBeenCalledWith(accounts, { action: 'list', uid: 1, account: 'test' })
      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toContain(JSON.stringify(mockResult, null, 2))
    })

    it('should call send tool', async () => {
      const mockResult = { status: 'success' }
      vi.mocked(send).mockResolvedValueOnce(mockResult as any)

      const request = { params: { name: 'send', arguments: { action: 'new', account: 'test', body: 'hello' } } }
      const result = await handler(request)

      expect(send).toHaveBeenCalledWith(accounts, { action: 'new', account: 'test', body: 'hello' })
      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toContain(JSON.stringify(mockResult, null, 2))
    })

    it('should call help tool and read its documentation file', async () => {
      vi.mocked(readFile).mockResolvedValueOnce('mock help docs')

      const request = { params: { name: 'help', arguments: { tool_name: 'messages' } } }
      const result = await handler(request)

      expect(readFile).toHaveBeenCalledTimes(1)
      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toContain('mock help docs')
    })

    it('should return error when help tool file is not found', async () => {
      vi.mocked(readFile).mockRejectedValueOnce(new Error('File not found'))

      const request = { params: { name: 'help', arguments: { tool_name: 'unknown' } } }
      const result = await handler(request)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Documentation not found for: unknown')
    })

    it('should return UNKNOWN_TOOL error for unknown tools', async () => {
      const request = { params: { name: 'unknown_tool', arguments: {} } }
      const result = await handler(request)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Unknown tool: unknown_tool')
    })

    it('should return MCP error object when a tool call fails', async () => {
      vi.mocked(messages).mockRejectedValueOnce(new Error('Tool failed'))

      const request = { params: { name: 'messages', arguments: { action: 'search' } } }
      const result = await handler(request)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Tool failed')
    })
  })
})
