import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { describe, expect, it, vi } from 'vitest'
import { registerTools } from './registry.js'

describe('registerTools', () => {
  describe('missing arguments in tool call', () => {
    it.each([
      { name: 'messages', arguments: undefined, description: 'undefined arguments' },
      { name: 'messages', arguments: null, description: 'null arguments' },
      { name: 'messages', description: 'missing arguments key entirely' }
    ])('should return error when $description', async (requestParams) => {
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
        params: requestParams
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
})
