import { readFile } from 'node:fs/promises'
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { describe, expect, it, vi } from 'vitest'
import { registerTools } from './registry.js'

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn()
}))

// Mock path and url as well since they are used for DOCS_DIR
vi.mock('node:path', () => ({
  dirname: vi.fn(() => '/mock/dir'),
  join: vi.fn((...args) => args.join('/'))
}))

vi.mock('node:url', () => ({
  fileURLToPath: vi.fn(() => '/mock/file.js')
}))

describe('handleHelp error handling', () => {
  it('should return DOC_NOT_FOUND error response when readFile fails', async () => {
    // 1. Setup mock Server instance and capture handler
    let callToolHandler: any
    const mockServer = {
      setRequestHandler: vi.fn((schema, handler) => {
        if (schema === CallToolRequestSchema) {
          callToolHandler = handler
        }
      })
    }

    // 2. Call registerTools
    registerTools(mockServer as any, [])

    // 3. Mock readFile to throw error
    vi.mocked(readFile).mockRejectedValueOnce(new Error('Read error'))

    // 4. Call the handler for 'help' tool
    const result = await callToolHandler({
      params: {
        name: 'help',
        arguments: { tool_name: 'messages' }
      }
    })

    // 5. Assert result is an error and contains appropriate message and code
    expect(result.isError).toBe(true)
    // The handleHelp catch block re-throws with a specific message that we can check
    expect(result.content[0].text).toContain('Documentation not found for: messages')
    expect(result.content[0].text).toContain('Check tool_name')
  })
})
