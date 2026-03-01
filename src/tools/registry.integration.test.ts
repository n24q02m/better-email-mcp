import { readFileSync } from 'node:fs'
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock dependencies before importing registry
vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
  statSync: vi.fn()
}))

// Import after mocking
import { registerTools } from './registry.js'

describe('registry.ts - help tool error handling', () => {
  let mockServer: any
  let callToolHandler: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockServer = {
      setRequestHandler: vi.fn((schema, handler) => {
        if (schema === CallToolRequestSchema) {
          callToolHandler = handler
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
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error('File not found')
    })

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
})
