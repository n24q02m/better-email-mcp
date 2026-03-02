import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountConfig } from './helpers/config.js'

// Mock dependencies before importing registry
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn()
}))

vi.mock('./composite/attachments.js', () => ({ attachments: vi.fn() }))
vi.mock('./composite/folders.js', () => ({ folders: vi.fn() }))
vi.mock('./composite/messages.js', () => ({ messages: vi.fn() }))
vi.mock('./composite/send.js', () => ({ send: vi.fn() }))
vi.mock('./helpers/security.js', () => ({ wrapToolResult: vi.fn((name, result) => result) }))

// Import after mocking
import { readFile } from 'node:fs/promises'
import { attachments } from './composite/attachments.js'
import { folders } from './composite/folders.js'
import { messages } from './composite/messages.js'
import { send } from './composite/send.js'
import { registerTools } from './registry.js'

describe('registerTools', () => {
  let mockServer: any
  let mockAccounts: AccountConfig[]

  beforeEach(() => {
    vi.clearAllMocks()

    mockServer = {
      setRequestHandler: vi.fn()
    } as any

    mockAccounts = []
  })

  it('should register handlers for ListTools, ListResources, ReadResource, and CallTool schemas', () => {
    registerTools(mockServer, mockAccounts)

    // Verify setRequestHandler was called 4 times
    expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(4)

    // Verify it was called with the specific schemas
    const schemas = mockServer.setRequestHandler.mock.calls.map((call: any) => call[0])
    expect(schemas).toContainEqual(ListToolsRequestSchema)
    expect(schemas).toContainEqual(ListResourcesRequestSchema)
    expect(schemas).toContainEqual(ReadResourceRequestSchema)
    expect(schemas).toContainEqual(CallToolRequestSchema)
  })

  it('should list all tools when ListToolsRequestSchema is called', async () => {
    registerTools(mockServer, mockAccounts)
    const listToolsHandler = mockServer.setRequestHandler.mock.calls.find(
      (call: any) => call[0] === ListToolsRequestSchema
    )?.[1]
    expect(listToolsHandler).toBeDefined()

    const result = await listToolsHandler()
    expect(result.tools).toBeDefined()
    expect(result.tools).toHaveLength(5)
    const toolNames = result.tools.map((t: any) => t.name)
    expect(toolNames).toContain('messages')
    expect(toolNames).toContain('folders')
    expect(toolNames).toContain('attachments')
    expect(toolNames).toContain('send')
    expect(toolNames).toContain('help')
  })

  it('should list all resources when ListResourcesRequestSchema is called', async () => {
    registerTools(mockServer, mockAccounts)
    const listResourcesHandler = mockServer.setRequestHandler.mock.calls.find(
      (call: any) => call[0] === ListResourcesRequestSchema
    )?.[1]
    expect(listResourcesHandler).toBeDefined()

    const result = await listResourcesHandler()
    expect(result.resources).toBeDefined()
    expect(result.resources).toHaveLength(5)
    const uris = result.resources.map((r: any) => r.uri)
    expect(uris).toContain('email://docs/messages')
    expect(uris).toContain('email://docs/folders')
    expect(uris).toContain('email://docs/attachments')
    expect(uris).toContain('email://docs/send')
    expect(uris).toContain('email://docs/help')
  })

  it('should read resource when ReadResourceRequestSchema is called with valid uri', async () => {
    registerTools(mockServer, mockAccounts)
    const readResourceHandler = mockServer.setRequestHandler.mock.calls.find(
      (call: any) => call[0] === ReadResourceRequestSchema
    )?.[1]
    expect(readResourceHandler).toBeDefined()

    vi.mocked(readFile).mockResolvedValue('# Messages Tool Docs')

    const request = {
      params: {
        uri: 'email://docs/messages'
      }
    }

    const result = await readResourceHandler(request)
    expect(result.contents).toBeDefined()
    expect(result.contents).toHaveLength(1)
    expect(result.contents[0].uri).toBe('email://docs/messages')
    expect(result.contents[0].mimeType).toBe('text/markdown')
    expect(result.contents[0].text).toBe('# Messages Tool Docs')
    expect(readFile).toHaveBeenCalled()
  })

  it('should throw error when ReadResourceRequestSchema is called with invalid uri', async () => {
    registerTools(mockServer, mockAccounts)
    const readResourceHandler = mockServer.setRequestHandler.mock.calls.find(
      (call: any) => call[0] === ReadResourceRequestSchema
    )?.[1]
    expect(readResourceHandler).toBeDefined()

    const request = {
      params: {
        uri: 'email://docs/invalid'
      }
    }

    await expect(readResourceHandler(request)).rejects.toThrow('Resource not found: email://docs/invalid')
  })

  it('should return error when no arguments are provided', async () => {
    // Call registerTools
    registerTools(mockServer, mockAccounts)

    // Find the handler for CallToolRequestSchema
    const callToolHandler = mockServer.setRequestHandler.mock.calls.find(
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

  it('should successfully dispatch to messages tool', async () => {
    registerTools(mockServer, mockAccounts)
    const callToolHandler = mockServer.setRequestHandler.mock.calls.find(
      (call: any) => call[0] === CallToolRequestSchema
    )?.[1]

    vi.mocked(messages).mockResolvedValue({ success: true, count: 5 })

    const request = {
      params: {
        name: 'messages',
        arguments: { action: 'search' }
      }
    }

    const result = await callToolHandler(request)

    expect(messages).toHaveBeenCalledWith(mockAccounts, { action: 'search' })
    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toBe(JSON.stringify({ success: true, count: 5 }, null, 2))
  })

  it('should successfully dispatch to folders tool', async () => {
    registerTools(mockServer, mockAccounts)
    const callToolHandler = mockServer.setRequestHandler.mock.calls.find(
      (call: any) => call[0] === CallToolRequestSchema
    )?.[1]

    vi.mocked(folders).mockResolvedValue({ folders: [] })

    const request = {
      params: {
        name: 'folders',
        arguments: { action: 'list' }
      }
    }

    const result = await callToolHandler(request)

    expect(folders).toHaveBeenCalledWith(mockAccounts, { action: 'list' })
    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toBe(JSON.stringify({ folders: [] }, null, 2))
  })

  it('should successfully dispatch to attachments tool', async () => {
    registerTools(mockServer, mockAccounts)
    const callToolHandler = mockServer.setRequestHandler.mock.calls.find(
      (call: any) => call[0] === CallToolRequestSchema
    )?.[1]

    vi.mocked(attachments).mockResolvedValue({ attachments: [] })

    const request = {
      params: {
        name: 'attachments',
        arguments: { action: 'list', account: 'test@test.com', uid: 1 }
      }
    }

    const result = await callToolHandler(request)

    expect(attachments).toHaveBeenCalledWith(mockAccounts, { action: 'list', account: 'test@test.com', uid: 1 })
    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toBe(JSON.stringify({ attachments: [] }, null, 2))
  })

  it('should successfully dispatch to send tool', async () => {
    registerTools(mockServer, mockAccounts)
    const callToolHandler = mockServer.setRequestHandler.mock.calls.find(
      (call: any) => call[0] === CallToolRequestSchema
    )?.[1]

    vi.mocked(send).mockResolvedValue({ success: true })

    const request = {
      params: {
        name: 'send',
        arguments: { action: 'new', account: 'test@test.com', to: 'test2@test.com', subject: 'Hi', body: 'Hello' }
      }
    }

    const result = await callToolHandler(request)

    expect(send).toHaveBeenCalledWith(mockAccounts, {
      action: 'new',
      account: 'test@test.com',
      to: 'test2@test.com',
      subject: 'Hi',
      body: 'Hello'
    })
    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toBe(JSON.stringify({ success: true }, null, 2))
  })

  it('should successfully dispatch to help tool', async () => {
    registerTools(mockServer, mockAccounts)
    const callToolHandler = mockServer.setRequestHandler.mock.calls.find(
      (call: any) => call[0] === CallToolRequestSchema
    )?.[1]

    vi.mocked(readFile).mockResolvedValue('# Messages Tool Documentation')

    const request = {
      params: {
        name: 'help',
        arguments: { tool_name: 'messages' }
      }
    }

    const result = await callToolHandler(request)

    expect(readFile).toHaveBeenCalled()
    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toBe(
      JSON.stringify({ tool: 'messages', documentation: '# Messages Tool Documentation' }, null, 2)
    )
  })
})
