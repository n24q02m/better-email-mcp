import { readFile } from 'node:fs/promises'
import { CallToolRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock dependencies before importing registry
vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
  statSync: vi.fn()
}))

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn()
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

    // 3. Mock readFile (from node:fs/promises) to reject (simulating missing file)
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
})

describe('registry.ts - ReadResource success', () => {
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

  it('should return markdown content for a valid resource URI', async () => {
    registerTools(mockServer, [])
    expect(readResourceHandler).toBeDefined()

    const docContent = '# Messages Tool\n\nFull documentation here.'
    vi.mocked(readFile).mockResolvedValue(docContent)

    const result = await readResourceHandler({
      params: { uri: 'email://docs/messages' }
    })

    expect(result).toEqual({
      contents: [
        {
          uri: 'email://docs/messages',
          mimeType: 'text/markdown',
          text: docContent
        }
      ]
    })
    expect(readFile).toHaveBeenCalledWith(expect.stringContaining('messages.md'), 'utf-8')
  })
})

describe('registry.ts - help tool success', () => {
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

  it('should return documentation content for a valid tool name', async () => {
    registerTools(mockServer, [])
    expect(callToolHandler).toBeDefined()

    const docContent = '# Messages\n\nSearch, read, and manage emails.'
    vi.mocked(readFile).mockResolvedValue(docContent)

    const result = await callToolHandler({
      params: {
        name: 'help',
        arguments: { tool_name: 'messages' }
      }
    })

    expect(result.isError).toBeUndefined()
    expect(result.content).toHaveLength(1)
    expect(result.content[0].type).toBe('text')

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.tool).toBe('messages')
    expect(parsed.documentation).toBe(docContent)

    expect(readFile).toHaveBeenCalledWith(expect.stringContaining('messages.md'), 'utf-8')
  })
})
