import { readFile } from 'node:fs/promises'
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { describe, expect, it, vi } from 'vitest'
import { isValidToolName } from './helpers/security.js'
import { registerTools } from './registry.js'

// Mock dependencies
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn()
}))

vi.mock('node:path', () => ({
  dirname: vi.fn(() => '/mock/dir'),
  join: vi.fn((...args) => args.join('/'))
}))

vi.mock('node:url', () => ({
  fileURLToPath: vi.fn(() => '/mock/file.js')
}))

vi.mock('./helpers/errors.js', async (importOriginal) => {
  const original = await importOriginal<any>()
  return {
    ...original,
    aiReadableMessage: vi.fn((error) => `Error: ${error.message} (Code: ${error.code})`)
  }
})

vi.mock('./helpers/security.js', async (importOriginal) => {
  const original = await importOriginal<any>()
  return {
    ...original,
    isValidToolName: vi.fn(original.isValidToolName)
  }
})

describe('handleHelp documentation tool', () => {
  const setupHandler = () => {
    let callToolHandler: any
    const mockServer = {
      setRequestHandler: vi.fn((schema, handler) => {
        if (schema === CallToolRequestSchema) {
          callToolHandler = handler
        }
      })
    }
    registerTools(mockServer as any, [])
    return callToolHandler
  }

  it('should return documentation when successfully reading the file', async () => {
    const handler = setupHandler()
    const mockContent = '# Messages Documentation'
    vi.mocked(readFile).mockResolvedValueOnce(mockContent)

    const result = await handler({
      params: {
        name: 'help',
        arguments: { tool_name: 'messages' }
      }
    })

    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toContain('messages')
    expect(result.content[0].text).toContain(mockContent)
  })

  it('should return DOC_NOT_FOUND error when readFile fails (catch block)', async () => {
    const handler = setupHandler()
    vi.mocked(readFile).mockRejectedValueOnce(new Error('File system error'))

    const result = await handler({
      params: {
        name: 'help',
        arguments: { tool_name: 'messages' }
      }
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Documentation not found for: messages')
    expect(result.content[0].text).toContain('Code: DOC_NOT_FOUND')
  })

  it('should return DOC_NOT_FOUND error when resource is missing from RESOURCES array', async () => {
    const handler = setupHandler()
    // Simulate isValidToolName passing but resource not found in RESOURCES
    vi.mocked(isValidToolName).mockReturnValueOnce(true)

    const result = await handler({
      params: {
        name: 'help',
        arguments: { tool_name: 'non-existent-resource' }
      }
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Documentation not found for: non-existent-resource')
    expect(result.content[0].text).toContain('Code: DOC_NOT_FOUND')
  })

  it('should return VALIDATION_ERROR when tool_name is invalid', async () => {
    const handler = setupHandler()
    vi.mocked(isValidToolName).mockReturnValueOnce(false)

    const result = await handler({
      params: {
        name: 'help',
        arguments: { tool_name: 'invalid-tool' }
      }
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Invalid tool name: invalid-tool')
    expect(result.content[0].text).toContain('Code: VALIDATION_ERROR')
  })
})
