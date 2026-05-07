import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { describe, expect, it, vi } from 'vitest'
import { EmailMCPError } from './helpers/errors.js'
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
  getCredentials: vi.fn(),
  setCredentials: vi.fn()
}))

describe('CallToolRequestSchema handler - error handling', () => {
  it('should return a properly formatted MCP error response for EmailMCPError', async () => {
    const { messages } = await import('./composite/messages.js')
    const customError = new EmailMCPError('Tool failed', 'TOOL_ERROR', 'Try again')
    vi.mocked(messages).mockRejectedValue(customError)

    const mockServer = {
      setRequestHandler: vi.fn()
    }
    registerTools(mockServer as any, [])

    const call = mockServer.setRequestHandler.mock.calls.find((call) => call[0] === CallToolRequestSchema)
    const handler = call![1]

    const result = await handler({
      params: {
        name: 'messages',
        arguments: { action: 'search', query: 'ALL' }
      }
    })

    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: 'Error: Tool failed\n\nSuggestion: Try again'
        }
      ],
      isError: true
    })
  })

  it('should return a properly formatted MCP error response for generic Error', async () => {
    const { folders } = await import('./composite/folders.js')
    vi.mocked(folders).mockRejectedValue(new Error('Unexpected system error'))

    const mockServer = {
      setRequestHandler: vi.fn()
    }
    registerTools(mockServer as any, [])

    const call = mockServer.setRequestHandler.mock.calls.find((call) => call[0] === CallToolRequestSchema)
    const handler = call![1]

    const result = await handler({
      params: {
        name: 'folders',
        arguments: { action: 'list' }
      }
    })

    // Generic errors are enhanced to UNKNOWN_ERROR with a suggestion
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Error: Unexpected system error')
    expect(result.content[0].text).toContain('Suggestion: Please check your request and try again')
  })
})
