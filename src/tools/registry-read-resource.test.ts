import { ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EmailMCPError } from './helpers/errors.js'

// Mock dependencies before importing registry
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue('mock content')
}))

import { registerTools } from './registry.js'

describe('registerTools - ReadResourceRequestSchema', () => {
  let mockServer: any
  let readResourceHandler: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockServer = {
      setRequestHandler: vi.fn((schema, handler) => {
        if (schema === ReadResourceRequestSchema) {
          readResourceHandler = handler
        }
      })
    }
  })

  it('should throw EmailMCPError with RESOURCE_NOT_FOUND code for invalid URI', async () => {
    // 1. Register tools
    registerTools(mockServer, [])

    // 2. Ensure handler was registered
    expect(readResourceHandler).toBeDefined()

    // 3. Call the handler with an invalid URI
    const request = {
      params: {
        uri: 'email://docs/nonexistent'
      }
    }

    // 4. Verify the error response
    await expect(readResourceHandler(request)).rejects.toThrow(EmailMCPError)

    try {
      await readResourceHandler(request)
    } catch (error: any) {
      expect(error.code).toBe('RESOURCE_NOT_FOUND')
      expect(error.message).toContain('Resource not found: email://docs/nonexistent')
    }
  })
})
