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

  it('should handle general tool execution errors', async () => {
    // Mock server
    const server = {
      setRequestHandler: vi.fn()
    } as any

    // Mock accounts
    const accounts = [] as any

    // Mock messages tool
    const { messages } = await import('./composite/messages.js')
    vi.mock('./composite/messages.js', () => ({
      messages: vi.fn().mockRejectedValue(new Error('Simulated tool error'))
    }))

    // Re-import registerTools to pick up the mock
    vi.resetModules()
    const { registerTools } = await import('./registry.js')

    // Call registerTools
    registerTools(server, accounts)

    // Find the handler for CallToolRequestSchema
    const callToolHandler = server.setRequestHandler.mock.calls.find(
      (call: any) => call[0] === CallToolRequestSchema
    )?.[1]

    expect(callToolHandler).toBeDefined()

    // Simulate request that triggers the mocked error
    const request = {
      params: {
        name: 'messages',
        arguments: { action: 'search' }
      }
    }

    const result = await callToolHandler(request)

    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: expect.stringContaining('Simulated tool error')
        }
      ],
      isError: true
    })
  })
})
