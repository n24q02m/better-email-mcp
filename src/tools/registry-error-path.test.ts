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

    it('should throw Resource not found for invalid URIs', async () => {
      const { readResourceHandler } = setupHandler()

      try {
        await readResourceHandler({ params: { uri: 'email://docs/unknown' } })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(EmailMCPError)
        expect((error as EmailMCPError).code).toBe('RESOURCE_NOT_FOUND')
      }
    })
  })

  describe('handleHelp paths', () => {
    it('should return documentation when tool name is valid', async () => {
      const { callToolHandler } = setupHandler()
      vi.mocked(readFile).mockResolvedValue('messages documentation')

      const result = await callToolHandler({
        params: {
          name: 'help',
          arguments: { tool_name: 'messages' }
        }
      })

      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toContain('messages documentation')
    })

    it('should throw VALIDATION_ERROR for invalid tool name', async () => {
      const { callToolHandler } = setupHandler()

      const result = await callToolHandler({
        params: {
          name: 'help',
          arguments: { tool_name: 'invalid-tool' }
        }
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Error: Invalid tool name: invalid-tool')
    })

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
    })
  })

  describe('CallToolRequestSchema paths', () => {
    it('should handle missing arguments', async () => {
      const { callToolHandler } = setupHandler([{ email: 'test@example.com' }])

      const result = await callToolHandler({
        params: {
          name: 'messages'
        }
      } as any)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toBe('Error: No arguments provided')
    })

    it('should handle unknown tool with suggestion', async () => {
      const { callToolHandler } = setupHandler([{ email: 'test@example.com' }])

      const result = await callToolHandler({
        params: {
          name: 'messagess', // typo
          arguments: { action: 'search' }
        }
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("Unknown tool: messagess. Did you mean 'messages'?")
    })

    it('should handle unknown tool without suggestion', async () => {
      const { callToolHandler } = setupHandler([{ email: 'test@example.com' }])

      const result = await callToolHandler({
        params: {
          name: 'xyz',
          arguments: { action: 'search' }
        }
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Unknown tool: xyz.')
      expect(result.content[0].text).not.toContain('Did you mean')
    })

    it('should call other tool handlers', async () => {
      const { callToolHandler } = setupHandler([{ email: 'test@example.com' }])
      const { attachments } = await import('./composite/attachments.js')
      const { send } = await import('./composite/send.js')
      const { handleConfig } = await import('./composite/config.js')

      vi.mocked(attachments).mockResolvedValue({ ok: true, action: 'list', attachments: [] } as any)
      vi.mocked(send).mockResolvedValue({ ok: true, action: 'new', messageId: '1' } as any)
      vi.mocked(handleConfig).mockResolvedValue({ ok: true, action: 'cache_clear', cleared: 0 } as any)

      await callToolHandler({
        params: { name: 'attachments', arguments: { action: 'list', account: 'test@example.com', uid: 1 } }
      })
      await callToolHandler({
        params: {
          name: 'send',
          arguments: { action: 'new', account: 'test@example.com', to: 'a@b.com', body: 'hi' }
        }
      })
      await callToolHandler({ params: { name: 'config', arguments: { action: 'status' } } })

      expect(attachments).toHaveBeenCalled()
      expect(send).toHaveBeenCalled()
      expect(handleConfig).toHaveBeenCalled()
    })

    describe('Credential guard branches', () => {
      it('should return setup instructions WITH url when unconfigured', async () => {
        const { getState, getSetupUrl } = await import('../credential-state.js')
        vi.mocked(getState).mockReturnValue('awaiting_setup')
        vi.mocked(getSetupUrl).mockReturnValue('https://setup.example.com')

        const { callToolHandler } = setupHandler([])

        const result = await callToolHandler({
          params: {
            name: 'messages',
            arguments: { action: 'search' }
          }
        })

        expect(result.isError).toBe(true)
        expect(result.content[0].text).toContain('open this URL in your browser:\nhttps://setup.example.com')
      })

      it('should return setup instructions WITHOUT url when unconfigured', async () => {
        const { getState, getSetupUrl } = await import('../credential-state.js')
        vi.mocked(getState).mockReturnValue('awaiting_setup')
        vi.mocked(getSetupUrl).mockReturnValue(null)

        const { callToolHandler } = setupHandler([])

        const result = await callToolHandler({
          params: {
            name: 'messages',
            arguments: { action: 'search' }
          }
        })

        expect(result.isError).toBe(true)
        expect(result.content[0].text).toContain('In stdio mode: set EMAIL_PROVIDER')
      })
    })

    describe('Catch block error types', () => {
      it('should handle EmailMCPError', async () => {
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

      it('should handle generic Error object', async () => {
        const { folders } = await import('./composite/folders.js')
        vi.mocked(folders).mockRejectedValue(new Error('Generic failure'))

        const { callToolHandler } = setupHandler([{ email: 'test@example.com' }])

        const result = await callToolHandler({
          params: {
            name: 'folders',
            arguments: { action: 'list' }
          }
        })

        expect(result.isError).toBe(true)
        expect(result.content[0].text).toContain('Error: Generic failure')
      })

      it('should handle circular structure serialization failure', async () => {
        const { folders } = await import('./composite/folders.js')
        const circular: any = {}
        circular.self = circular
        vi.mocked(folders).mockResolvedValue(circular)

        const { callToolHandler } = setupHandler([{ email: 'test@example.com' }])

        const result = await callToolHandler({
          params: {
            name: 'folders',
            arguments: { action: 'list' }
          }
        })

        expect(result.isError).toBe(true)
        expect(result.content[0].text).toContain('Error: Converting circular structure to JSON')
      })

      it('should handle wrapToolResult failure (undefined return)', async () => {
        const { messages } = await import('./composite/messages.js')
        vi.mocked(messages).mockResolvedValue(undefined as any)

        const { callToolHandler } = setupHandler([{ email: 'test@example.com' }])

        const result = await callToolHandler({
          params: {
            name: 'messages',
            arguments: { action: 'search' }
          }
        })

        expect(result.isError).toBe(true)
        expect(result.content[0].text).toContain('Error')
      })

      it('should handle loadConfig failure during hot-reload', async () => {
        const { getState } = await import('../credential-state.js')
        const { loadConfig } = await import('./helpers/config.js')

        vi.mocked(getState).mockReturnValue('configured')
        vi.mocked(loadConfig).mockRejectedValue(new Error('Hot-reload failed'))

        const { callToolHandler } = setupHandler([])

        const result = await callToolHandler({
          params: {
            name: 'messages',
            arguments: { action: 'search' }
          }
        })

        expect(result.isError).toBe(true)
        expect(result.content[0].text).toContain('Error: Hot-reload failed')
      })
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
        ],
        structuredContent: mockOpenRelayResult
      })
      expect(mockOpenRelayHandler).toHaveBeenCalled()
    })
  })
})
