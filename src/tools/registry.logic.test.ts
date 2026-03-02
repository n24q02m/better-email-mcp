import { CallToolRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js'
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

  it('should throw error when reading unknown resource', async () => {
    // Mock server
    const server = {
      setRequestHandler: vi.fn()
    } as any

    // Mock accounts
    const accounts = [] as any

    // Call registerTools
    registerTools(server, accounts)

    // Find the handler for ReadResourceRequestSchema
    const readResourceHandler = server.setRequestHandler.mock.calls.find(
      (call: any) => call[0] === ReadResourceRequestSchema
    )?.[1]

    expect(readResourceHandler).toBeDefined()

    // Simulate request with unknown uri
    const request = {
      params: {
        uri: 'email://docs/nonexistent'
      }
    }

    // Since registerTools uses throw new EmailMCPError, we can expect it to reject
    await expect(readResourceHandler(request)).rejects.toThrow('Resource not found: email://docs/nonexistent')
  })
})
