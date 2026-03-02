import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./composite/attachments.js', () => ({ attachments: vi.fn() }))
vi.mock('./composite/folders.js', () => ({ folders: vi.fn() }))
vi.mock('./composite/messages.js', () => ({ messages: vi.fn() }))
vi.mock('./composite/send.js', () => ({ send: vi.fn() }))
vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }))

import { readFile } from 'node:fs/promises'
import { attachments } from './composite/attachments.js'
import { folders } from './composite/folders.js'
import { messages } from './composite/messages.js'
import { send } from './composite/send.js'
import { EmailMCPError } from './helpers/errors.js'
import type { AccountConfig } from './helpers/config.js'
import { registerTools } from './registry.js'

describe('registerTools', () => {
  let server: any
  const accounts: AccountConfig[] = []

  function getHandler(schema: any) {
    const call = server.setRequestHandler.mock.calls.find((c: any) => c[0] === schema)
    return call ? call[1] : undefined
  }

  beforeEach(() => {
    vi.clearAllMocks()
    server = {
      setRequestHandler: vi.fn()
    }
    registerTools(server, accounts)
  })

  it('registers all required tool handlers', () => {
    expect(getHandler(ListToolsRequestSchema)).toBeDefined()
    expect(getHandler(ListResourcesRequestSchema)).toBeDefined()
    expect(getHandler(ReadResourceRequestSchema)).toBeDefined()
    expect(getHandler(CallToolRequestSchema)).toBeDefined()
  })

  describe('ListToolsRequestSchema handler', () => {
    it('returns the list of tools', async () => {
      const handler = getHandler(ListToolsRequestSchema)
      const result = await handler()
      expect(result.tools).toBeDefined()
      expect(Array.isArray(result.tools)).toBe(true)
      expect(result.tools.length).toBe(5)
      expect(result.tools.map((t: any) => t.name)).toEqual(['messages', 'folders', 'attachments', 'send', 'help'])
    })
  })

  describe('ListResourcesRequestSchema handler', () => {
    it('returns the list of resources with text/markdown mimeType', async () => {
      const handler = getHandler(ListResourcesRequestSchema)
      const result = await handler()
      expect(result.resources).toBeDefined()
      expect(Array.isArray(result.resources)).toBe(true)
      expect(result.resources.length).toBeGreaterThan(0)
      for (const res of result.resources) {
        expect(res.mimeType).toBe('text/markdown')
        expect(res.uri).toMatch(/^email:\/\/docs\//)
      }
    })
  })

  describe('ReadResourceRequestSchema handler', () => {
    it('returns resource contents when given a valid URI', async () => {
      vi.mocked(readFile).mockResolvedValueOnce('# Messages Doc')
      const handler = getHandler(ReadResourceRequestSchema)

      const result = await handler({
        params: { uri: 'email://docs/messages' }
      })

      expect(result.contents).toBeDefined()
      expect(result.contents).toHaveLength(1)
      expect(result.contents[0].uri).toBe('email://docs/messages')
      expect(result.contents[0].mimeType).toBe('text/markdown')
      expect(result.contents[0].text).toBe('# Messages Doc')
      expect(readFile).toHaveBeenCalledTimes(1)
    })

    it('throws an EmailMCPError when given an unknown URI', async () => {
      const handler = getHandler(ReadResourceRequestSchema)

      await expect(handler({ params: { uri: 'email://docs/unknown' } })).rejects.toThrow(EmailMCPError)
    })
  })

  describe('CallToolRequestSchema handler', () => {
    it('returns error when no arguments are provided', async () => {
      const handler = getHandler(CallToolRequestSchema)
      const request = { params: { name: 'messages' } } // arguments missing
      const result = await handler(request)

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

    it('calls the appropriate composite tool and wraps the result', async () => {
      const mockResult = { success: true }
      vi.mocked(messages).mockResolvedValueOnce(mockResult as any)

      const handler = getHandler(CallToolRequestSchema)
      const result = await handler({
        params: {
          name: 'messages',
          arguments: { action: 'search' }
        }
      })

      expect(messages).toHaveBeenCalledWith(accounts, { action: 'search' })
      expect(result.content).toHaveLength(1)
      expect(result.content[0].type).toBe('text')
      // Note: wrapToolResult wraps untrusted content with markers
      expect(result.content[0].text).toContain('<untrusted_email_content>')
      expect(result.content[0].text).toContain(JSON.stringify(mockResult, null, 2))
    })

    it('returns help documentation for the help tool', async () => {
      vi.mocked(readFile).mockResolvedValueOnce('# Folders Tool')
      const handler = getHandler(CallToolRequestSchema)

      const result = await handler({
        params: {
          name: 'help',
          arguments: { tool_name: 'folders' }
        }
      })

      expect(readFile).toHaveBeenCalledTimes(1)
      // Help tool output is wrapped appropriately
      expect(result.content[0].text).toContain('"documentation": "# Folders Tool"')
    })

    it('catches execution errors and returns an MCP error object', async () => {
      vi.mocked(folders).mockRejectedValueOnce(new Error('Internal folder error'))

      const handler = getHandler(CallToolRequestSchema)
      const result = await handler({
        params: {
          name: 'folders',
          arguments: { action: 'list' }
        }
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].type).toBe('text')
      expect(result.content[0].text).toContain('Internal folder error')
    })
  })
})
