import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { describe, expect, it, vi } from 'vitest'
import { EmailMCPError } from './helpers/errors.js'
import { registerTools } from './registry.js'

// Mock dependencies to isolate the registry
vi.mock('./composite/messages.js', () => ({ messages: vi.fn(), clearArchiveFolderCache: vi.fn() }))
vi.mock('./composite/folders.js', () => ({ folders: vi.fn() }))
vi.mock('./composite/attachments.js', () => ({ attachments: vi.fn() }))
vi.mock('./composite/send.js', () => ({ send: vi.fn() }))
vi.mock('./composite/config.js', () => ({ handleConfig: vi.fn() }))
vi.mock('./helpers/config.js', () => ({ loadConfig: vi.fn() }))

vi.mock('../credential-state.js', () => ({
  getState: vi.fn(() => 'configured'),
  getSetupUrl: vi.fn(() => null)
}))

describe('registry.ts CallToolRequestSchema - error path coverage', () => {
  const setupHandler = (initialAccounts: any[] = [{ email: 'test@example.com' }]) => {
    let callToolHandler: any
    const mockServer = {
      setRequestHandler: vi.fn((schema, handler) => {
        if (schema === CallToolRequestSchema) {
          callToolHandler = handler
        }
      })
    }
    registerTools(mockServer as any, initialAccounts)
    return { callToolHandler }
  }

  it('should handle EmailMCPError and return its readable message', async () => {
    const { messages } = await import('./composite/messages.js')
    const customError = new EmailMCPError('Specific error', 'SPECIFIC_CODE', 'Try this fix')
    vi.mocked(messages).mockRejectedValue(customError)

    const { callToolHandler } = setupHandler()

    const result = await callToolHandler({
      params: {
        name: 'messages',
        arguments: { action: 'search', query: 'ALL' }
      }
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('Error: Specific error\n\nSuggestion: Try this fix')
  })

  it('should handle generic Error and enhance it', async () => {
    const { folders } = await import('./composite/folders.js')
    vi.mocked(folders).mockRejectedValue(new Error('Internal failure'))

    const { callToolHandler } = setupHandler()

    const result = await callToolHandler({
      params: {
        name: 'folders',
        arguments: { action: 'list' }
      }
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Error: Internal failure')
    expect(result.content[0].text).toContain('Suggestion: Please check your request and try again')
  })

  it('should handle non-Error objects thrown by tool handlers', async () => {
    const { attachments } = await import('./composite/attachments.js')
    vi.mocked(attachments).mockRejectedValue({ message: 'Object error', code: 'FOO' })

    const { callToolHandler } = setupHandler()

    const result = await callToolHandler({
      params: {
        name: 'attachments',
        arguments: { action: 'list', account: 'test@example.com', uid: 1 }
      }
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Error: Object error')
    // Verify details are included for unknown errors with details
    expect(result.content[0].text).toContain('"code": "FOO"')
  })

  it('should handle primitive string errors by wrapping them in Details', async () => {
    const { send } = await import('./composite/send.js')
    vi.mocked(send).mockRejectedValue('String error message')

    const { callToolHandler } = setupHandler()

    const result = await callToolHandler({
      params: {
        name: 'send',
        arguments: { action: 'new', account: 'test@example.com', to: 'a@b.com', body: 'hi' }
      }
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Error: Unknown error occurred')
    expect(result.content[0].text).toContain('"String error message"')
  })

  it('should handle errors during result stringification (e.g., circular reference)', async () => {
    const { messages } = await import('./composite/messages.js')

    // Create a circular reference object
    const circular: any = {}
    circular.self = circular

    vi.mocked(messages).mockResolvedValue(circular)

    const { callToolHandler } = setupHandler()

    const result = await callToolHandler({
      params: {
        name: 'messages',
        arguments: { action: 'search', query: 'ALL' }
      }
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Error: Converting circular structure to JSON')
  })
})
