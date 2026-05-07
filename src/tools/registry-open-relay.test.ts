import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock buildOpenRelayHandler so the test does not spin up the real daemon
// helpers (smart-stdio, browser) which require actual filesystem + child
// processes. The handler we substitute returns a deterministic OpenRelayResult.
const mockOpenRelayResult = {
  url: 'http://127.0.0.1:51234/authorize?session=abc',
  browserOpened: true,
  status: 'unconfigured' as const
}

vi.mock('@n24q02m/mcp-core', () => ({
  buildOpenRelayHandler: vi.fn(() => vi.fn(async () => mockOpenRelayResult))
}))

// Mock composite tools (avoid IMAP/SMTP side effects)
vi.mock('./composite/attachments.js', () => ({ attachments: vi.fn() }))
vi.mock('./composite/folders.js', () => ({ folders: vi.fn() }))
vi.mock('./composite/messages.js', () => ({ messages: vi.fn(), clearArchiveFolderCache: vi.fn() }))
vi.mock('./composite/send.js', () => ({ send: vi.fn() }))
vi.mock('./composite/config.js', () => ({ handleConfig: vi.fn() }))

// Default credential-state mock: server starts unconfigured. Individual tests
// can override via vi.mocked(...).mockReturnValue(...).
vi.mock('../credential-state.js', () => ({
  getState: vi.fn(() => 'awaiting_setup'),
  getSetupUrl: vi.fn(() => null),
  getCredentials: vi.fn(),
  setCredentials: vi.fn()
}))

import { registerTools } from './registry.js'

describe('config__open_relay tool registration', () => {
  let mockServer: any
  let listToolsHandler: any
  let callToolHandler: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockServer = {
      setRequestHandler: vi.fn((schema, handler) => {
        if (schema === ListToolsRequestSchema) {
          listToolsHandler = handler
        }
        if (schema === CallToolRequestSchema) {
          callToolHandler = handler
        }
      })
    }
    registerTools(mockServer, [])
  })

  it('TOOLS list includes config__open_relay descriptor', async () => {
    const listed = await listToolsHandler({})
    const names = listed.tools.map((t: { name: string }) => t.name)
    expect(names).toContain('config__open_relay')

    const tool = listed.tools.find((t: { name: string }) => t.name === 'config__open_relay')
    expect(tool).toBeDefined()
    expect(tool.inputSchema).toEqual({
      type: 'object',
      properties: {},
      additionalProperties: false
    })
    expect(tool.annotations.openWorldHint).toBe(true)
  })

  it('CallTool dispatch returns wrapped JSON with url, browserOpened, status', async () => {
    const result = await callToolHandler({
      params: {
        name: 'config__open_relay',
        arguments: {}
      }
    })

    expect(result.isError).toBeUndefined()
    expect(result.content).toHaveLength(1)
    expect(result.content[0].type).toBe('text')

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed).toEqual(mockOpenRelayResult)
    expect(parsed).toHaveProperty('url')
    expect(parsed).toHaveProperty('browserOpened')
    expect(parsed).toHaveProperty('status')
  })

  it('config__open_relay works when no accounts are configured (credential guard exempt)', async () => {
    // Re-register with explicit empty accounts to assert guard is bypassed.
    const freshServer = {
      setRequestHandler: vi.fn((schema, handler) => {
        if (schema === CallToolRequestSchema) {
          callToolHandler = handler
        }
      })
    }
    registerTools(freshServer as any, [])

    const result = await callToolHandler({
      params: {
        name: 'config__open_relay',
        arguments: {}
      }
    })

    // Must NOT return setup-instructions error; must hit our handler.
    expect(result.isError).toBeUndefined()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.url).toBe(mockOpenRelayResult.url)
  })
})
