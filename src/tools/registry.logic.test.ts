import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import { describe, expect, it, vi } from 'vitest'

// Mock composite tools
vi.mock('./composite/messages.js', () => ({ messages: vi.fn() }))
vi.mock('./composite/folders.js', () => ({ folders: vi.fn() }))
vi.mock('./composite/attachments.js', () => ({ attachments: vi.fn() }))
vi.mock('./composite/send.js', () => ({ send: vi.fn() }))
vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }))

import { registerTools } from './registry.js'

describe('registerTools', () => {
  it('should return error when no arguments are provided', async () => {
    // Mock server
    const server = {
      setRequestHandler: vi.fn()
    } as any

    // Mock accounts
    const accounts = [] as any

    // Call registerTools
    registerTools(server, accounts)

    // Find the handler for CallToolRequestSchema
    const callToolHandler = server.setRequestHandler.mock.calls.find(
      (call: any) => call[0] === CallToolRequestSchema
    )?.[1]

    expect(callToolHandler).toBeDefined()

    // Simulate request with missing arguments
    const request = {
      params: {
        name: 'messages',
        arguments: undefined
      }
    }

    const result = await callToolHandler(request)

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
})

/**
 * Helper to create a mock server and extract registered handlers
 */
function createMockServerWithHandlers() {
  const handlers = new Map<any, any>()
  const server = {
    setRequestHandler: vi.fn((schema: any, handler: any) => {
      handlers.set(schema, handler)
    })
  } as any

  registerTools(server, [])

  return {
    server,
    handlers,
    getHandler: (schema: any) => handlers.get(schema)
  }
}

describe('ListToolsRequestSchema handler', () => {
  it('should return exactly 5 tools with correct names', async () => {
    const { getHandler } = createMockServerWithHandlers()
    const handler = getHandler(ListToolsRequestSchema)

    expect(handler).toBeDefined()

    const result = await handler({})

    expect(result.tools).toHaveLength(5)
    const names = result.tools.map((t: any) => t.name)
    expect(names).toEqual(['messages', 'folders', 'attachments', 'send', 'help'])
  })
})

describe('ListResourcesRequestSchema handler', () => {
  it('should return resources with correct URIs and mimeType', async () => {
    const { getHandler } = createMockServerWithHandlers()
    const handler = getHandler(ListResourcesRequestSchema)

    expect(handler).toBeDefined()

    const result = await handler({})

    expect(result.resources).toHaveLength(5)

    const expectedUris = [
      'email://docs/messages',
      'email://docs/folders',
      'email://docs/attachments',
      'email://docs/send',
      'email://docs/help'
    ]

    for (const resource of result.resources) {
      expect(resource.mimeType).toBe('text/markdown')
      expect(expectedUris).toContain(resource.uri)
    }

    const uris = result.resources.map((r: any) => r.uri)
    expect(uris).toEqual(expectedUris)
  })
})

describe('ReadResourceRequestSchema handler', () => {
  it('should throw for unknown resource URI', async () => {
    const { getHandler } = createMockServerWithHandlers()
    const handler = getHandler(ReadResourceRequestSchema)

    expect(handler).toBeDefined()

    await expect(handler({ params: { uri: 'email://docs/nonexistent' } })).rejects.toThrow(
      'Resource not found: email://docs/nonexistent'
    )
  })

  it('should return contents for known resource URI', async () => {
    const { readFile } = await import('node:fs/promises')
    vi.mocked(readFile).mockResolvedValue('# Messages Docs Content')

    const { getHandler } = createMockServerWithHandlers()
    const handler = getHandler(ReadResourceRequestSchema)

    const result = await handler({ params: { uri: 'email://docs/messages' } })

    expect(result.contents).toHaveLength(1)
    expect(result.contents[0].uri).toBe('email://docs/messages')
    expect(result.contents[0].mimeType).toBe('text/markdown')
    expect(result.contents[0].text).toBe('# Messages Docs Content')
  })
})

describe('CallToolRequestSchema handler - successful tool calls', () => {
  it('should call messages function and return wrapped JSON result', async () => {
    const { messages } = await import('./composite/messages.js')
    const mockResult = { emails: [{ uid: 1, subject: 'Test' }] }
    vi.mocked(messages).mockResolvedValue(mockResult)

    const { getHandler } = createMockServerWithHandlers()
    const handler = getHandler(CallToolRequestSchema)

    const result = await handler({
      params: {
        name: 'messages',
        arguments: { action: 'search', query: 'UNSEEN' }
      }
    })

    expect(messages).toHaveBeenCalledWith([], { action: 'search', query: 'UNSEEN' })
    expect(result.isError).toBeUndefined()
    expect(result.content).toHaveLength(1)
    expect(result.content[0].type).toBe('text')
    // messages tool wraps with untrusted_email_content tags
    expect(result.content[0].text).toContain('<untrusted_email_content>')
    expect(result.content[0].text).toContain(JSON.stringify(mockResult, null, 2))
  })

  it('should call folders function and return JSON result', async () => {
    const { folders } = await import('./composite/folders.js')
    const mockResult = { folders: [{ name: 'INBOX', path: 'INBOX' }] }
    vi.mocked(folders).mockResolvedValue(mockResult)

    const { getHandler } = createMockServerWithHandlers()
    const handler = getHandler(CallToolRequestSchema)

    const result = await handler({
      params: {
        name: 'folders',
        arguments: { action: 'list' }
      }
    })

    expect(folders).toHaveBeenCalledWith([], { action: 'list' })
    expect(result.isError).toBeUndefined()
    expect(result.content).toHaveLength(1)
    expect(result.content[0].type).toBe('text')
    // folders tool is NOT in EXTERNAL_CONTENT_TOOLS, so no wrapping
    expect(result.content[0].text).toBe(JSON.stringify(mockResult, null, 2))
  })

  it('should call send function and return JSON result', async () => {
    const { send } = await import('./composite/send.js')
    const mockResult = { success: true, messageId: '<abc@test.com>' }
    vi.mocked(send).mockResolvedValue(mockResult)

    const { getHandler } = createMockServerWithHandlers()
    const handler = getHandler(CallToolRequestSchema)

    const result = await handler({
      params: {
        name: 'send',
        arguments: { action: 'new', account: 'test@test.com', to: 'to@test.com', body: 'Hello' }
      }
    })

    expect(send).toHaveBeenCalledWith([], {
      action: 'new',
      account: 'test@test.com',
      to: 'to@test.com',
      body: 'Hello'
    })
    expect(result.isError).toBeUndefined()
    expect(result.content).toHaveLength(1)
    expect(result.content[0].type).toBe('text')
    // send tool is NOT in EXTERNAL_CONTENT_TOOLS, so no wrapping
    expect(result.content[0].text).toBe(JSON.stringify(mockResult, null, 2))
  })

  it('should call attachments function and return wrapped JSON result', async () => {
    const { attachments } = await import('./composite/attachments.js')
    const mockResult = { attachments: [{ filename: 'doc.pdf', size: 1024 }] }
    vi.mocked(attachments).mockResolvedValue(mockResult)

    const { getHandler } = createMockServerWithHandlers()
    const handler = getHandler(CallToolRequestSchema)

    const result = await handler({
      params: {
        name: 'attachments',
        arguments: { action: 'list', account: 'test@test.com', uid: 1 }
      }
    })

    expect(attachments).toHaveBeenCalledWith([], { action: 'list', account: 'test@test.com', uid: 1 })
    expect(result.isError).toBeUndefined()
    expect(result.content).toHaveLength(1)
    expect(result.content[0].type).toBe('text')
    // attachments tool wraps with untrusted_email_content tags
    expect(result.content[0].text).toContain('<untrusted_email_content>')
    expect(result.content[0].text).toContain(JSON.stringify(mockResult, null, 2))
  })
})

describe('CallToolRequestSchema handler - tool execution error', () => {
  it('should catch and format EmailMCPError thrown by tool without enhancement', async () => {
    const { messages } = await import('./composite/messages.js')
    const { EmailMCPError } = await import('./helpers/errors.js')
    const customError = new EmailMCPError('Custom validation failed', 'CUSTOM_ERR', 'Try something else')
    vi.mocked(messages).mockRejectedValue(customError)

    const { getHandler } = createMockServerWithHandlers()
    const handler = getHandler(CallToolRequestSchema)

    const result = await handler({
      params: {
        name: 'messages',
        arguments: { action: 'search', query: 'ALL' }
      }
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Custom validation failed')
    expect(result.content[0].text).toContain('Try something else')
  })

  it('should catch and enhance non-EmailMCPError thrown by tool', async () => {
    const { messages } = await import('./composite/messages.js')
    vi.mocked(messages).mockRejectedValue(new Error('IMAP connection failed'))

    const { getHandler } = createMockServerWithHandlers()
    const handler = getHandler(CallToolRequestSchema)

    const result = await handler({
      params: {
        name: 'messages',
        arguments: { action: 'search', query: 'ALL' }
      }
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('IMAP connection failed')
  })
})

describe('CallToolRequestSchema handler - unknown tool', () => {
  it('should return error for unknown tool name', async () => {
    const { getHandler } = createMockServerWithHandlers()
    const handler = getHandler(CallToolRequestSchema)

    const result = await handler({
      params: {
        name: 'nonexistent_tool',
        arguments: { action: 'test' }
      }
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Unknown tool: nonexistent_tool')
  })
})

describe('CallToolRequestSchema handler - help tool', () => {
  it('should return documentation for valid tool', async () => {
    const { readFile } = await import('node:fs/promises')
    vi.mocked(readFile).mockResolvedValue('# Folders Tool Help Content')

    const { getHandler } = createMockServerWithHandlers()
    const handler = getHandler(CallToolRequestSchema)

    const result = await handler({
      params: {
        name: 'help',
        arguments: { tool_name: 'folders' }
      }
    })

    expect(result.isError).toBeUndefined()
    expect(result.content[0].type).toBe('text')
    // Result JSON parses properly and has the right data
    const parsed = JSON.parse(
      result.content[0].text.replace('<untrusted_email_content>\n', '').replace('\n</untrusted_email_content>', '')
    )
    expect(parsed.tool).toBe('folders')
    expect(parsed.documentation).toBe('# Folders Tool Help Content')
  })

  it('should throw validation error for invalid tool name', async () => {
    const { getHandler } = createMockServerWithHandlers()
    const handler = getHandler(CallToolRequestSchema)

    const result = await handler({
      params: {
        name: 'help',
        arguments: { tool_name: 'nonexistent' }
      }
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Invalid tool name: nonexistent')
    expect(result.content[0].text).toContain('Valid: messages, folders, attachments, send, help')
  })

  it('should throw error when documentation file read fails', async () => {
    const { readFile } = await import('node:fs/promises')
    vi.mocked(readFile).mockRejectedValue(new Error('File not found'))

    const { getHandler } = createMockServerWithHandlers()
    const handler = getHandler(CallToolRequestSchema)

    const result = await handler({
      params: {
        name: 'help',
        arguments: { tool_name: 'messages' }
      }
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Documentation not found for: messages')
    expect(result.content[0].text).toContain('Check tool_name')
  })
})
