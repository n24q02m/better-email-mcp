import { readFile } from 'node:fs/promises'
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountConfig } from './helpers/config.js'
import { registerTools } from './registry.js'

vi.mock('./helpers/security.js', () => ({
  wrapToolResult: vi.fn((name, result) => `<email_mcp_tool_result name="${name}">${result}</email_mcp_tool_result>`)
}))

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

describe('registerTools', () => {
  let mockServer: any
  let mockAccounts: AccountConfig[]

  beforeEach(() => {
    vi.clearAllMocks()
    mockServer = {
      setRequestHandler: vi.fn()
    }
    mockAccounts = []
  })

  it('should register all necessary schemas', () => {
    registerTools(mockServer, mockAccounts)

    expect(mockServer.setRequestHandler).toHaveBeenCalledWith(ListToolsRequestSchema, expect.any(Function))
    expect(mockServer.setRequestHandler).toHaveBeenCalledWith(ListResourcesRequestSchema, expect.any(Function))
    expect(mockServer.setRequestHandler).toHaveBeenCalledWith(ReadResourceRequestSchema, expect.any(Function))
    expect(mockServer.setRequestHandler).toHaveBeenCalledWith(CallToolRequestSchema, expect.any(Function))
  })

  it('should return tools when ListToolsRequestSchema is called', async () => {
    registerTools(mockServer, mockAccounts)
    const handler = mockServer.setRequestHandler.mock.calls.find((call: any) => call[0] === ListToolsRequestSchema)?.[1]
    expect(handler).toBeDefined()

    const result = await handler()
    expect(result.tools).toBeDefined()
    expect(Array.isArray(result.tools)).toBe(true)
    expect(result.tools.length).toBe(5)
  })

  it('should return resources when ListResourcesRequestSchema is called', async () => {
    registerTools(mockServer, mockAccounts)
    const handler = mockServer.setRequestHandler.mock.calls.find(
      (call: any) => call[0] === ListResourcesRequestSchema
    )?.[1]
    expect(handler).toBeDefined()

    const result = await handler()
    expect(result.resources).toBeDefined()
    expect(Array.isArray(result.resources)).toBe(true)
    expect(result.resources.length).toBe(5) // 5 RESOURCES defined in registry.ts
  })

  it('should return resource content when ReadResourceRequestSchema is called with valid uri', async () => {
    registerTools(mockServer, mockAccounts)
    const handler = mockServer.setRequestHandler.mock.calls.find(
      (call: any) => call[0] === ReadResourceRequestSchema
    )?.[1]
    expect(handler).toBeDefined()

    vi.mocked(readFile).mockResolvedValueOnce('mock file content')

    const result = await handler({ params: { uri: 'email://docs/messages' } })
    expect(result.contents).toBeDefined()
    expect(result.contents[0].uri).toBe('email://docs/messages')
    expect(result.contents[0].text).toBe('mock file content')
  })

  it('should throw when ReadResourceRequestSchema is called with invalid uri', async () => {
    registerTools(mockServer, mockAccounts)
    const handler = mockServer.setRequestHandler.mock.calls.find(
      (call: any) => call[0] === ReadResourceRequestSchema
    )?.[1]
    expect(handler).toBeDefined()

    await expect(handler({ params: { uri: 'email://docs/invalid' } })).rejects.toThrow('Resource not found')
  })

  it('should return error when no arguments are provided', async () => {
    registerTools(mockServer, mockAccounts)

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

  it('should call messages composite tool successfully', async () => {
    registerTools(mockServer, mockAccounts)
    const handler = mockServer.setRequestHandler.mock.calls.find((call: any) => call[0] === CallToolRequestSchema)?.[1]
    const { messages } = await import('./composite/messages.js')
    vi.mocked(messages).mockResolvedValueOnce({ some: 'result' })

    const request = { params: { name: 'messages', arguments: { action: 'search' } } }
    const result = await handler(request)

    expect(messages).toHaveBeenCalledWith(mockAccounts, { action: 'search' })
    expect(result.isError).toBeUndefined() // not true
    expect(result.content[0].text).toContain('<email_mcp_tool_result')
    expect(result.content[0].text).toContain('{\n  "some": "result"\n}')
  })

  it('should call folders composite tool successfully', async () => {
    registerTools(mockServer, mockAccounts)
    const handler = mockServer.setRequestHandler.mock.calls.find((call: any) => call[0] === CallToolRequestSchema)?.[1]

    const { folders } = await import('./composite/folders.js')
    vi.mocked(folders).mockResolvedValueOnce({ folders: ['INBOX'] })

    const request = { params: { name: 'folders', arguments: { action: 'list' } } }
    const result = await handler(request)

    expect(folders).toHaveBeenCalledWith(mockAccounts, { action: 'list' })
    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toContain('<email_mcp_tool_result')
  })

  it('should call attachments composite tool successfully', async () => {
    registerTools(mockServer, mockAccounts)
    const handler = mockServer.setRequestHandler.mock.calls.find((call: any) => call[0] === CallToolRequestSchema)?.[1]

    const { attachments } = await import('./composite/attachments.js')
    vi.mocked(attachments).mockResolvedValueOnce({ file: 'data' })

    const request = { params: { name: 'attachments', arguments: { action: 'list' } } }
    const result = await handler(request)

    expect(attachments).toHaveBeenCalledWith(mockAccounts, { action: 'list' })
    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toContain('<email_mcp_tool_result')
  })

  it('should call send composite tool successfully', async () => {
    registerTools(mockServer, mockAccounts)
    const handler = mockServer.setRequestHandler.mock.calls.find((call: any) => call[0] === CallToolRequestSchema)?.[1]

    const { send } = await import('./composite/send.js')
    vi.mocked(send).mockResolvedValueOnce({ sent: true })

    const request = { params: { name: 'send', arguments: { action: 'new' } } }
    const result = await handler(request)

    expect(send).toHaveBeenCalledWith(mockAccounts, { action: 'new' })
    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toContain('<email_mcp_tool_result')
  })

  it('should handle help tool call successfully', async () => {
    registerTools(mockServer, mockAccounts)
    const handler = mockServer.setRequestHandler.mock.calls.find((call: any) => call[0] === CallToolRequestSchema)?.[1]

    vi.mocked(readFile).mockResolvedValueOnce('help doc content')

    const request = { params: { name: 'help', arguments: { tool_name: 'messages' } } }
    const result = await handler(request)

    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toContain('<email_mcp_tool_result')
    expect(result.content[0].text).toContain('"tool": "messages"')
    expect(result.content[0].text).toContain('"documentation": "help doc content"')
  })

  it('should handle tool execution error gracefully', async () => {
    registerTools(mockServer, mockAccounts)
    const handler = mockServer.setRequestHandler.mock.calls.find((call: any) => call[0] === CallToolRequestSchema)?.[1]

    const { messages } = await import('./composite/messages.js')
    vi.mocked(messages).mockRejectedValueOnce(new Error('Test error'))

    const request = { params: { name: 'messages', arguments: { action: 'search' } } }
    const result = await handler(request)

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Error: Test error')
  })
})
