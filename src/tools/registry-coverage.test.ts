import { CallToolRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { describe, expect, it, vi } from 'vitest'
import { EmailMCPError } from './helpers/errors.js'
import { registerTools } from './registry.js'

// Mock dependencies
vi.mock('./composite/messages.js', () => ({ messages: vi.fn(), clearArchiveFolderCache: vi.fn() }))
vi.mock('./composite/folders.js', () => ({ folders: vi.fn() }))
vi.mock('./composite/attachments.js', () => ({ attachments: vi.fn() }))
vi.mock('./composite/send.js', () => ({ send: vi.fn() }))
vi.mock('./composite/config.js', () => ({ handleConfig: vi.fn() }))
vi.mock('./helpers/config.js', () => ({ loadConfig: vi.fn() }))

vi.mock('../credential-state.js', () => ({
  getState: vi.fn(),
  getSetupUrl: vi.fn()
}))

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn()
}))

describe('registry.ts coverage - additional paths', () => {
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

  describe('CallToolRequestSchema error handling', () => {
    it('should handle non-Error objects thrown by tool handlers', async () => {
      const { messages } = await import('./composite/messages.js')
      // Throwing a string to trigger the generic error path in enhanceError
      vi.mocked(messages).mockRejectedValue({ message: 'Something went wrong' })

      const { callToolHandler } = setupHandler([{ email: 'test@example.com' }])

      const result = await callToolHandler({
        params: {
          name: 'messages',
          arguments: { action: 'search', query: 'ALL' }
        }
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Error: Something went wrong')
    })
  })

  describe('Credential guard and hot-reload', () => {
    it('should trigger hot-reload when state is "configured" but accounts are empty', async () => {
      const { getState } = await import('../credential-state.js')
      const { loadConfig } = await import('./helpers/config.js')
      const { messages } = await import('./composite/messages.js')

      vi.mocked(getState).mockReturnValue('configured')
      vi.mocked(loadConfig).mockResolvedValue([{ email: 'reloaded@example.com' }] as any)
      vi.mocked(messages).mockResolvedValue({ emails: [] })

      const { callToolHandler } = setupHandler([]) // Start with empty accounts

      await callToolHandler({
        params: {
          name: 'messages',
          arguments: { action: 'search', query: 'ALL' }
        }
      })

      expect(loadConfig).toHaveBeenCalled()
      expect(messages).toHaveBeenCalledWith([{ email: 'reloaded@example.com' }], expect.anything())
    })

    it('should return setup instructions with URL when unconfigured', async () => {
      const { getState, getSetupUrl } = await import('../credential-state.js')
      vi.mocked(getState).mockReturnValue('awaiting_setup')
      vi.mocked(getSetupUrl).mockReturnValue('https://setup.example.com')

      const { callToolHandler } = setupHandler([])

      const result = await callToolHandler({
        params: {
          name: 'messages',
          arguments: { action: 'search', query: 'ALL' }
        }
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Email credentials are not configured yet')
      expect(result.content[0].text).toContain('https://setup.example.com')
    })

    it('should return setup instructions without URL when unconfigured and no URL available', async () => {
      const { getState, getSetupUrl } = await import('../credential-state.js')
      vi.mocked(getState).mockReturnValue('awaiting_setup')
      vi.mocked(getSetupUrl).mockReturnValue(null)

      const { callToolHandler } = setupHandler([])

      const result = await callToolHandler({
        params: {
          name: 'messages',
          arguments: { action: 'search', query: 'ALL' }
        }
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Email credentials are not configured')
      expect(result.content[0].text).not.toContain('open this URL')
    })
  })

  describe('Config tool', () => {
    it('should invoke handleConfig when config tool is called', async () => {
      const { handleConfig } = await import('./composite/config.js')
      const mockResult = { action: 'cache_clear', ok: true, cleared: 0 } as const
      vi.mocked(handleConfig).mockResolvedValue(mockResult)

      const { callToolHandler } = setupHandler([{ email: 'test@example.com' }])

      const result = await callToolHandler({
        params: {
          name: 'config',
          arguments: { action: 'status' }
        }
      })

      expect(handleConfig).toHaveBeenCalled()
      // config is an internal tool, not in EXTERNAL_CONTENT_TOOLS — bare structuredContent
      expect(result.structuredContent).toEqual(mockResult)
    })
  })

  describe('ReadResourceRequestSchema', () => {
    it('should throw Resource not found for invalid URIs', async () => {
      const { readResourceHandler } = setupHandler()

      try {
        await readResourceHandler({ params: { uri: 'email://docs/unknown' } })
      } catch (error) {
        expect(error).toBeInstanceOf(EmailMCPError)
        expect((error as EmailMCPError).code).toBe('RESOURCE_NOT_FOUND')
      }
    })
  })
})
