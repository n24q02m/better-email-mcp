import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { describe, expect, it, vi } from 'vitest'
import { registerTools } from './registry.js'

// Mock the composite tools to isolate the test
vi.mock('./composite/attachments.js', () => ({ attachments: vi.fn() }))
vi.mock('./composite/folders.js', () => ({ folders: vi.fn() }))
vi.mock('./composite/messages.js', () => ({ messages: vi.fn() }))
vi.mock('./composite/send.js', () => ({ send: vi.fn() }))

// Mock account config (minimal)
const mockAccounts: any[] = []

describe('registerTools', () => {
  it('should handle unknown tool execution gracefully', async () => {
    // specific mock for Server
    const mockServer = {
      setRequestHandler: vi.fn()
    }

    // Call the function under test
    registerTools(mockServer as any, mockAccounts)

    // Find the handler for CallToolRequestSchema
    // The first argument to setRequestHandler is the schema, the second is the handler
    const call = mockServer.setRequestHandler.mock.calls.find((call) => call[0] === CallToolRequestSchema)
    expect(call).toBeDefined()

    const handler = call![1]
    expect(handler).toBeTypeOf('function')

    // Invoke the handler with an unknown tool name
    const request = {
      params: {
        name: 'unknown_tool_name',
        arguments: {}
      }
    }

    const result = await handler(request)

    // Verify the result is an error response
    expect(result.isError).toBe(true)
    expect(result.content).toHaveLength(1)
    expect(result.content[0].text).toContain('Unknown tool: unknown_tool_name')
    // Verify it lists available tools
    expect(result.content[0].text).toContain('Available tools: messages, folders, attachments, send, help')
  })
})
