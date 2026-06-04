import { readFile } from 'node:fs/promises'
import { CallToolRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { buildOpenRelayHandler } from '@n24q02m/mcp-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerTools } from './registry.js'

// Mock dependencies
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn()
}))

vi.mock('@n24q02m/mcp-core', () => ({
  buildOpenRelayHandler: vi.fn(() => vi.fn())
}))

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

describe('registry.ts additional coverage', () => {
  let callToolHandler: any
  let readResourceHandler: any
  let mockOpenRelayHandler: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockOpenRelayHandler = vi.fn()
    vi.mocked(buildOpenRelayHandler).mockReturnValue(mockOpenRelayHandler)

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
    registerTools(mockServer as any, [{ email: 'test@example.com' }] as any)
  })

  describe('ReadResourceRequestSchema', () => {
    it('should successfully read a resource', async () => {
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

  describe('CallToolRequestSchema - config__open_relay', () => {
    it('should handle errors in openRelayHandler', async () => {
      mockOpenRelayHandler.mockRejectedValue(new Error('Relay failed'))

      const result = await callToolHandler({
        params: {
          name: 'config__open_relay',
          arguments: {}
        }
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Error: Relay failed')
    })

    it('should successfully call config__open_relay', async () => {
      const mockResult = { url: 'https://relay.example.com', browserOpened: true }
      mockOpenRelayHandler.mockResolvedValue(mockResult)

      const result = await callToolHandler({
        params: {
          name: 'config__open_relay',
          arguments: {}
        }
      })

      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toBe(JSON.stringify(mockResult, null, 2))
    })
  })

  describe('Help tool - handleHelp paths', () => {
    it('should successfully return documentation content (line 268)', async () => {
      vi.mocked(readFile).mockResolvedValue('help content')

      const result = await callToolHandler({
        params: {
          name: 'help',
          arguments: { tool_name: 'messages' }
        }
      })

      expect(result.content[0].text).toContain('help content')
    })

    it('should throw EmailMCPError when readFile fails in handleHelp (line 269)', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('File system error'))

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

  describe('CallToolRequestSchema - other tools (lines 279-280)', () => {
    it('should call attachments tool', async () => {
      const { attachments } = await import('./composite/attachments.js')
      vi.mocked(attachments).mockResolvedValue({ success: true })

      await callToolHandler({
        params: {
          name: 'attachments',
          arguments: { action: 'list', account: 'test@example.com', uid: 1 }
        }
      })

      expect(attachments).toHaveBeenCalled()
    })

    it('should call send tool', async () => {
      const { send } = await import('./composite/send.js')
      vi.mocked(send).mockResolvedValue({ success: true })

      await callToolHandler({
        params: {
          name: 'send',
          arguments: { action: 'new', account: 'test@example.com', to: 'to@example.com', body: 'hi' }
        }
      })

      expect(send).toHaveBeenCalled()
    })
  })

  describe('CallToolRequestSchema - catch-all error handling (line 400)', () => {
    it('should handle null thrown as error', async () => {
      const { messages } = await import('./composite/messages.js')
      vi.mocked(messages).mockRejectedValue(null)

      const result = await callToolHandler({
        params: {
          name: 'messages',
          arguments: { action: 'search' }
        }
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Error: Unknown error occurred')
    })

    it('should handle string thrown as error', async () => {
      const { messages } = await import('./composite/messages.js')
      vi.mocked(messages).mockRejectedValue('Something broke')

      const result = await callToolHandler({
        params: {
          name: 'messages',
          arguments: { action: 'search' }
        }
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Error: Unknown error occurred')
    })

    it('should handle object without message thrown as error', async () => {
      const { messages } = await import('./composite/messages.js')
      vi.mocked(messages).mockRejectedValue({ someProp: 'value' })

      const result = await callToolHandler({
        params: {
          name: 'messages',
          arguments: { action: 'search' }
        }
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Error: Unknown error occurred')
    })
  })
})
