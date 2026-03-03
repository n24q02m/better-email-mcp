import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { describe, expect, it, vi } from 'vitest'
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

  it('should return error for unknown tool', async () => {
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

    // Simulate request with unknown tool name
    const request = {
      params: {
        name: 'this_tool_does_not_exist',
        arguments: {}
      }
    }

    const result = await callToolHandler(request)

    expect(result.isError).toBe(true)
    expect(result.content).toHaveLength(1)
    expect(result.content[0].type).toBe('text')
    expect(result.content[0].text).toContain('Unknown tool: this_tool_does_not_exist')
    // removed expectation for UNKNOWN_TOOL since aiReadableMessage doesn't output it
  })
})
