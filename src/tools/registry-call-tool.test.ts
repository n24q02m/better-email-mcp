import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerTools } from './registry.js'

// Mock the composite tools to isolate the test
vi.mock('./composite/attachments.js', () => ({ attachments: vi.fn() }))
vi.mock('./composite/folders.js', () => ({ folders: vi.fn() }))
vi.mock('./composite/messages.js', () => ({ messages: vi.fn() }))
vi.mock('./composite/send.js', () => ({ send: vi.fn() }))

// Mock credential state to return 'configured' so tools execute normally
vi.mock('../credential-state.js', () => ({
  getState: vi.fn(() => 'configured'),
  getSetupUrl: vi.fn(() => null),
  triggerRelaySetup: vi.fn()
}))

describe('CallToolRequestSchema handler coverage', () => {
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
    registerTools(mockServer, [])
  })

  it('should return error when no arguments are provided', async () => {
    const result = await callToolHandler({
      params: {
        name: 'messages',
        arguments: null
      }
    })

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

  it('should provide suggestion for unknown tool', async () => {
    const result = await callToolHandler({
      params: {
        name: 'message', // misspelled
        arguments: { action: 'search' }
      }
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain("Unknown tool: message. Did you mean 'messages'?")
    expect(result.content[0].text).toContain('Available tools: messages, folders, attachments, send, setup, help')
  })

  it('should successfully call a tool and wrap the result', async () => {
    const { messages } = await import('./composite/messages.js')
    const mockResult = { success: true, count: 1 }
    vi.mocked(messages).mockResolvedValue(mockResult)

    const result = await callToolHandler({
      params: {
        name: 'messages',
        arguments: { action: 'search', query: 'ALL' }
      }
    })

    expect(result.isError).toBeUndefined()
    expect(result.content).toHaveLength(1)
    expect(result.content[0].type).toBe('text')

    // The result is wrapped by wrapToolResult which adds safety tags for 'messages'
    expect(result.content[0].text).toContain('<untrusted_email_content>')
    expect(result.content[0].text).toContain('</untrusted_email_content>')
    expect(result.content[0].text).toContain(JSON.stringify(mockResult, null, 2))
  })

  it('should handle tool handler throwing an error', async () => {
    const { folders } = await import('./composite/folders.js')
    vi.mocked(folders).mockRejectedValue(new Error('Unexpected error'))

    const result = await callToolHandler({
      params: {
        name: 'folders',
        arguments: { action: 'list' }
      }
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Error: Unexpected error')
    expect(result.content[0].text).toContain('Suggestion: Please check your request and try again')
  })
})
