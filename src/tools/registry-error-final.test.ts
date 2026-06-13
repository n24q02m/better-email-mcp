import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EmailMCPError } from './helpers/errors.js'
import { registerTools } from './registry.js'

// Mock dependencies
vi.mock('./composite/messages.js', () => ({ messages: vi.fn() }))
vi.mock('./composite/folders.js', () => ({ folders: vi.fn() }))
vi.mock('./composite/attachments.js', () => ({ attachments: vi.fn() }))
vi.mock('./composite/send.js', () => ({ send: vi.fn() }))
vi.mock('./composite/config.js', () => ({ handleConfig: vi.fn() }))
vi.mock('./helpers/config.js', () => ({ loadConfig: vi.fn() }))

vi.mock('../credential-state.js', () => ({
  getState: vi.fn(() => 'configured'),
  getSetupUrl: vi.fn(() => null)
}))

vi.mock('./helpers/security.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./helpers/security.js')>()
  return {
    ...actual,
    isValidToolName: vi.fn(actual.isValidToolName)
  }
})

describe('registry.ts coverage - final error paths', () => {
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

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('CallToolRequestSchema line 400 catch block', () => {
    it('should catch and format EmailMCPError', async () => {
      const { messages } = await import('./composite/messages.js')
      const customError = new EmailMCPError('Tool failed', 'TOOL_ERROR', 'Try again')
      vi.mocked(messages).mockRejectedValue(customError)

      const { callToolHandler } = setupHandler()

      const result = await callToolHandler({
        params: {
          name: 'messages',
          arguments: { action: 'search', query: 'ALL' }
        }
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toBe('Error: Tool failed\n\nSuggestion: Try again')
    })

    it('should catch and format generic Error', async () => {
      const { folders } = await import('./composite/folders.js')
      vi.mocked(folders).mockRejectedValue(new Error('Unexpected system error'))

      const { callToolHandler } = setupHandler()

      const result = await callToolHandler({
        params: {
          name: 'folders',
          arguments: { action: 'list' }
        }
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Error: Unexpected system error')
      expect(result.content[0].text).toContain('Suggestion: Please check your request and try again')
    })
  })

  describe('handleHelp line 264', () => {
    it('should throw DOC_NOT_FOUND if resource is missing but tool name is valid', async () => {
      const { isValidToolName } = await import('./helpers/security.js')
      vi.mocked(isValidToolName).mockReturnValue(true)

      const { callToolHandler } = setupHandler()

      const result = await callToolHandler({
        params: {
          name: 'help',
          arguments: { tool_name: 'non-existent-tool' }
        }
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Error: Documentation not found for: non-existent-tool')
      expect(result.content[0].text).toContain('Suggestion: Check tool_name')
    })
  })
})
