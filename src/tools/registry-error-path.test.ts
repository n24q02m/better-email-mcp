import { readFile } from 'node:fs/promises'
import { CallToolRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EmailMCPError } from './helpers/errors.js'
import { registerTools } from './registry.js'

// Mock dependencies
vi.mock('./composite/messages.js', () => ({ messages: vi.fn(), clearArchiveFolderCache: vi.fn() }))
vi.mock('./composite/folders.js', () => ({ folders: vi.fn() }))
vi.mock('./composite/attachments.js', () => ({ attachments: vi.fn() }))
vi.mock('./composite/send.js', () => ({ send: vi.fn() }))
vi.mock('./composite/config.js', () => ({ handleConfig: vi.fn() }))
vi.mock('./helpers/config.js', () => ({ loadConfig: vi.fn() }))

// Mock buildOpenRelayHandler from @n24q02m/mcp-core
const mockOpenRelayResult = { url: 'http://localhost/setup', browserOpened: true }
const mockOpenRelayHandler = vi.fn().mockResolvedValue(mockOpenRelayResult)
vi.mock('@n24q02m/mcp-core', () => ({
  buildOpenRelayHandler: vi.fn(() => mockOpenRelayHandler)
}))

vi.mock('../credential-state.js', () => ({
  getState: vi.fn(),
  getSetupUrl: vi.fn()
}))

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn()
}))

describe('registry.ts coverage - error and edge paths', () => {
  const setupHandler = (initialAccounts: any[] = []) => {
    let callToolHandler: any
    let readResourceHandler: any
    const mockServer = {
      setRequestHandler: vi.fn((schema, handler) => {
        if (schema === CallToolRequestSchema) {
          callToolHandler = handler
        }
        if (schema === ReadResourceRequestSchema) {
          readResourceHandler = handler
        }
      })
    }
    registerTools(mockServer as any, initialAccounts)
    return { callToolHandler, readResourceHandler }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockOpenRelayHandler.mockResolvedValue(mockOpenRelayResult)
  })

  describe('ReadResourceRequestSchema', () => {
    it('should successfully read a resource', async () => {
      const { readResourceHandler } = setupHandler()
      vi.mocked(readFile).mockResolvedValue('mock documentation content')

      const result = await readResourceHandler({
        params: { uri: 'email://docs/messages' }
      })

      expect(result).toEqual({
        contents: [
          {
            uri: 'email://docs/messages',
            mimeType: 'text/markdown',
            text: 'mock documentation content'
          }
        ]
      })
      expect(readFile).toHaveBeenCalled()
    })
  })

  describe('handleHelp error path', () => {
    it('should throw DOC_NOT_FOUND when readFile fails in handleHelp', async () => {
      const { callToolHandler } = setupHandler()
      vi.mocked(readFile).mockRejectedValue(new Error('File not found'))

      const result = await callToolHandler({
        params: {
          name: 'help',
          arguments: { tool_name: 'messages' }
        }
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Error: Documentation not found for: messages')
      expect(result.content[0].text).toContain('Suggestion: Check tool_name')
    })
  })

  describe('CallToolRequestSchema catch block', () => {
    it('should handle EmailMCPError in the main catch block', async () => {
      const { messages } = await import('./composite/messages.js')
      const customError = new EmailMCPError('Directly thrown EmailMCPError', 'DIRECT_ERROR', 'Fix it')
      vi.mocked(messages).mockRejectedValue(customError)

      const { callToolHandler } = setupHandler([{ email: 'test@example.com' }])

      const result = await callToolHandler({
        params: {
          name: 'messages',
          arguments: { action: 'search', query: 'ALL' }
        }
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Error: Directly thrown EmailMCPError')
      expect(result.content[0].text).toContain('Suggestion: Fix it')
    })

    it('should handle primitive string errors in the main catch block', async () => {
      const { folders } = await import('./composite/folders.js')
      // Throwing a string to trigger enhanceError via the main catch block
      vi.mocked(folders).mockRejectedValue('String error')

      const { callToolHandler } = setupHandler([{ email: 'test@example.com' }])

      const result = await callToolHandler({
        params: {
          name: 'folders',
          arguments: { action: 'list' }
        }
      })

      expect(result.isError).toBe(true)
      // When a string is thrown, enhanceError creates an UNKNOWN_ERROR with details: "String error"
      expect(result.content[0].text).toContain('Error: Unknown error occurred')
      expect(result.content[0].text).toContain('Details: "String error"')
    })

    it('should handle null/undefined errors in the main catch block', async () => {
      const { folders } = await import('./composite/folders.js')
      vi.mocked(folders).mockRejectedValue(null)

      const { callToolHandler } = setupHandler([{ email: 'test@example.com' }])

      const result = await callToolHandler({
        params: {
          name: 'folders',
          arguments: { action: 'list' }
        }
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Error: Unknown error occurred')
    })

    it('should handle generic Error objects in the main catch block', async () => {
      const { attachments } = await import('./composite/attachments.js')
      vi.mocked(attachments).mockRejectedValue(new Error('Generic error message'))

      const { callToolHandler } = setupHandler([{ email: 'test@example.com' }])

      const result = await callToolHandler({
        params: {
          name: 'attachments',
          arguments: { action: 'get', messageId: '123', fileName: 'test.txt' }
        }
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Error: Generic error message')
    })

    it('should handle JSON.stringify failures in the main catch block', async () => {
      const { attachments } = await import('./composite/attachments.js')
      const circular: any = {}
      circular.self = circular
      vi.mocked(attachments).mockResolvedValue(circular)

      const { callToolHandler } = setupHandler([{ email: 'test@example.com' }])

      const result = await callToolHandler({
        params: {
          name: 'attachments',
          arguments: { action: 'get', messageId: '123', fileName: 'test.txt' }
        }
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Error:')
      // JSON.stringify circular error message varies by node version but contains "circular"
      expect(result.content[0].text.toLowerCase()).toContain('circular')
    })

    it('should handle IMAP authentication errors in the main catch block', async () => {
      const { messages } = await import('./composite/messages.js')
      vi.mocked(messages).mockRejectedValue(new Error('AUTHENTICATIONFAILED'))

      const { callToolHandler } = setupHandler([{ email: 'test@example.com' }])

      const result = await callToolHandler({
        params: {
          name: 'messages',
          arguments: { action: 'search', query: 'ALL' }
        }
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Error: Email authentication failed')
      expect(result.content[0].text).toContain('Suggestion: Check that your email and App Password are correct')
    })
  })

  describe('config__open_relay', () => {
    it('should successfully call config__open_relay', async () => {
      const { callToolHandler } = setupHandler()

      const result = await callToolHandler({
        params: {
          name: 'config__open_relay',
          arguments: {}
        }
      })

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockOpenRelayResult, null, 2)
          }
        ]
      })
      expect(mockOpenRelayHandler).toHaveBeenCalled()
    })
  })
})
