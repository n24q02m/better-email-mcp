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

const mockOpenRelayResult = { url: 'http://localhost/setup' }
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

vi.mock('./helpers/security.js', async (importOriginal) => {
  const actual = await importOriginal<any>()
  return {
    ...actual,
    wrapToolResult: vi.fn(actual.wrapToolResult)
  }
})

describe('registry.ts catch block coverage', () => {
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
    mockOpenRelayHandler.mockResolvedValue(mockOpenRelayResult)
  })

  it('handles EmailMCPError in catch block', async () => {
    const { messages } = await import('./composite/messages.js')
    const error = new EmailMCPError('Tool error', 'TOOL_ERROR', 'Fix it')
    vi.mocked(messages).mockRejectedValue(error)

    const { callToolHandler } = setupHandler()
    const result = await callToolHandler({
      params: { name: 'messages', arguments: { action: 'search', query: 'ALL' } }
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Error: Tool error')
    expect(result.content[0].text).toContain('Suggestion: Fix it')
  })

  it('handles generic Error in catch block', async () => {
    const { folders } = await import('./composite/folders.js')
    vi.mocked(folders).mockRejectedValue(new Error('Unexpected error'))

    const { callToolHandler } = setupHandler()
    const result = await callToolHandler({
      params: { name: 'folders', arguments: { action: 'list' } }
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Error: Unexpected error')
  })

  it('handles SMTP error (enhanced) in catch block', async () => {
    const { send } = await import('./composite/send.js')
    const smtpError = new Error('SMTP failed')
    ;(smtpError as any).responseCode = 535
    vi.mocked(send).mockRejectedValue(smtpError)

    const { callToolHandler } = setupHandler()
    const result = await callToolHandler({
      params: { name: 'send', arguments: { action: 'new', account: 't@e.com', body: 'hi' } }
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('SMTP authentication failed')
  })

  it('handles error from config__open_relay', async () => {
    mockOpenRelayHandler.mockRejectedValue(new Error('Relay failed'))

    const { callToolHandler } = setupHandler()
    const result = await callToolHandler({
      params: { name: 'config__open_relay', arguments: {} }
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Error: Relay failed')
  })

  it('handles error from wrapToolResult (TypeError)', async () => {
    const { wrapToolResult } = await import('./helpers/security.js')
    const { messages } = await import('./composite/messages.js')

    vi.mocked(messages).mockResolvedValue({ ok: true })
    vi.mocked(wrapToolResult).mockImplementation(() => {
      throw new TypeError('Wrap failed')
    })

    const { callToolHandler } = setupHandler()
    const result = await callToolHandler({
      params: { name: 'messages', arguments: { action: 'search', query: 'ALL' } }
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Error: Wrap failed')
  })

  it('handles non-error objects in catch block', async () => {
    const { folders } = await import('./composite/folders.js')
    vi.mocked(folders).mockRejectedValue({ message: 'Object error' })

    const { callToolHandler } = setupHandler()
    const result = await callToolHandler({
      params: { name: 'folders', arguments: { action: 'list' } }
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Error: Object error')
  })

  it('handles string errors in catch block', async () => {
    const { folders } = await import('./composite/folders.js')
    vi.mocked(folders).mockRejectedValue('String error')

    const { callToolHandler } = setupHandler()
    const result = await callToolHandler({
      params: { name: 'folders', arguments: { action: 'list' } }
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Error: Unknown error occurred')
  })

  it('handles null error in catch block', async () => {
    const { folders } = await import('./composite/folders.js')
    vi.mocked(folders).mockRejectedValue(null)

    const { callToolHandler } = setupHandler()
    const result = await callToolHandler({
      params: { name: 'folders', arguments: { action: 'list' } }
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Error: Unknown error occurred')
  })
})

describe('registry.ts top-level branches', () => {
  it('covers DOCS_DIR bundled branch when __dirname ends with bin', async () => {
    vi.resetModules()
    vi.doMock('node:path', async (importOriginal) => {
      const actual = await importOriginal<any>()
      return {
        ...actual,
        dirname: vi.fn(() => '/mock/app/bin'),
        join: vi.fn((...args) => args.join('/'))
      }
    })

    const { registerTools } = await import('./registry.js')
    const { ReadResourceRequestSchema } = await import('@modelcontextprotocol/sdk/types.js')
    const { readFile } = await import('node:fs/promises')

    let readHandler: any
    const mockServer = {
      setRequestHandler: vi.fn((schema, handler) => {
        if (schema === ReadResourceRequestSchema) {
          readHandler = handler
        }
      })
    }
    registerTools(mockServer as any, [])

    vi.mocked(readFile).mockResolvedValue('content')
    await readHandler({ params: { uri: 'email://docs/messages' } })

    // Path should contain 'build/src/docs'
    expect(vi.mocked(readFile).mock.calls[0][0]).toContain('build/src/docs')
  })
})
