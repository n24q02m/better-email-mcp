import { readFile } from 'node:fs/promises'
import { CallToolRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EmailMCPError } from './helpers/errors.js'

// Mock dependencies before importing registry
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn()
}))

// Import after mocking
import { registerTools } from './registry.js'

describe('registry.ts - help tool error handling', () => {
  let mockServer: any
  let callToolHandler: any
  let readResourceHandler: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockServer = {
      setRequestHandler: vi.fn((schema, handler) => {
        if (schema === CallToolRequestSchema) {
          callToolHandler = handler
        } else if (schema === ReadResourceRequestSchema) {
          readResourceHandler = handler
        }
      })
    }
  })

  it('should return a friendly error when documentation is missing', async () => {
    // 1. Register tools
    registerTools(mockServer, [])

    // 2. Ensure handler was registered
    expect(callToolHandler).toBeDefined()

    // 3. Mock readFileSync to throw an error (simulating missing file)
    vi.mocked(readFile).mockRejectedValue(new Error('File not found'))

    // 4. Call the handler with 'help' tool
    const result = await callToolHandler({
      params: {
        name: 'help',
        arguments: { tool_name: 'nonexistent-tool' }
      }
    })

    // 5. Verify the error response
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Documentation not found for: nonexistent-tool')
  })

  it('should throw EmailMCPError when reading an unknown resource uri', async () => {
    // 1. Register tools
    registerTools(mockServer, [])

    // 2. Ensure handler was registered
    expect(readResourceHandler).toBeDefined()

    // 3. Call the handler with an unknown uri
    const request = {
      params: { uri: 'email://docs/unknown' }
    }

    // 4. Verify it throws EmailMCPError
    await expect(readResourceHandler(request)).rejects.toThrow(EmailMCPError)
    await expect(readResourceHandler(request)).rejects.toThrow('Resource not found: email://docs/unknown')
  })
})
