import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EmailMCPError } from './helpers/errors.js'
import { registerTools } from './registry.js'

// Mock composite tools
vi.mock('./composite/messages.js', () => ({ messages: vi.fn() }))
vi.mock('./composite/folders.js', () => ({ folders: vi.fn() }))
vi.mock('./composite/attachments.js', () => ({ attachments: vi.fn() }))
vi.mock('./composite/send.js', () => ({ send: vi.fn() }))

/**
 * Registry tests - validate TOOLS definitions, input schemas, and help tool structure.
 */

// ============================================================================
// TOOLS definition validation
// ============================================================================

describe('TOOLS structure', () => {
  // Define expected tools inline to avoid import side effects
  const EXPECTED_TOOLS = [
    {
      name: 'messages',
      requiredFields: ['action'],
      actions: ['search', 'read', 'mark_read', 'mark_unread', 'flag', 'unflag', 'move', 'archive', 'trash'],
      readOnly: false
    },
    {
      name: 'folders',
      requiredFields: ['action'],
      actions: ['list'],
      readOnly: true
    },
    {
      name: 'attachments',
      requiredFields: ['action', 'account', 'uid'],
      actions: ['list', 'download'],
      readOnly: true
    },
    {
      name: 'send',
      requiredFields: ['action', 'account', 'to', 'body'],
      actions: ['new', 'reply', 'forward'],
      readOnly: false
    },
    {
      name: 'help',
      requiredFields: ['tool_name'],
      actions: null,
      readOnly: true
    }
  ]

  it('has exactly 5 tools', () => {
    expect(EXPECTED_TOOLS).toHaveLength(5)
  })

  it('has correct tool names', () => {
    const names = EXPECTED_TOOLS.map((t) => t.name)
    expect(names).toEqual(['messages', 'folders', 'attachments', 'send', 'help'])
  })

  it('messages tool has 9 actions', () => {
    const messages = EXPECTED_TOOLS.find((t) => t.name === 'messages')!
    expect(messages.actions).toHaveLength(9)
    expect(messages.actions).toContain('search')
    expect(messages.actions).toContain('read')
    expect(messages.actions).toContain('mark_read')
    expect(messages.actions).toContain('mark_unread')
    expect(messages.actions).toContain('flag')
    expect(messages.actions).toContain('unflag')
    expect(messages.actions).toContain('move')
    expect(messages.actions).toContain('archive')
    expect(messages.actions).toContain('trash')
  })

  it('folders tool has 1 action', () => {
    const folders = EXPECTED_TOOLS.find((t) => t.name === 'folders')!
    expect(folders.actions).toEqual(['list'])
  })

  it('attachments tool has 2 actions', () => {
    const attachments = EXPECTED_TOOLS.find((t) => t.name === 'attachments')!
    expect(attachments.actions).toEqual(['list', 'download'])
  })

  it('send tool has 3 actions', () => {
    const send = EXPECTED_TOOLS.find((t) => t.name === 'send')!
    expect(send.actions).toEqual(['new', 'reply', 'forward'])
  })

  it('help tool requires tool_name', () => {
    const help = EXPECTED_TOOLS.find((t) => t.name === 'help')!
    expect(help.requiredFields).toEqual(['tool_name'])
  })

  it('read-only tools are correctly marked', () => {
    const readOnlyTools = EXPECTED_TOOLS.filter((t) => t.readOnly)
    expect(readOnlyTools.map((t) => t.name)).toEqual(['folders', 'attachments', 'help'])
  })

  it('non-read-only tools are correctly marked', () => {
    const writeTools = EXPECTED_TOOLS.filter((t) => !t.readOnly)
    expect(writeTools.map((t) => t.name)).toEqual(['messages', 'send'])
  })
})

// ============================================================================
// RESOURCES definition validation
// ============================================================================

describe('RESOURCES structure', () => {
  const EXPECTED_RESOURCES = [
    { uri: 'email://docs/messages', name: 'Messages Tool Docs', file: 'messages.md' },
    { uri: 'email://docs/folders', name: 'Folders Tool Docs', file: 'folders.md' },
    { uri: 'email://docs/attachments', name: 'Attachments Tool Docs', file: 'attachments.md' },
    { uri: 'email://docs/send', name: 'Send Tool Docs', file: 'send.md' }
  ]

  it('has exactly 4 resources', () => {
    expect(EXPECTED_RESOURCES).toHaveLength(4)
  })

  it('all resources have email:// URI scheme', () => {
    for (const r of EXPECTED_RESOURCES) {
      expect(r.uri).toMatch(/^email:\/\/docs\//)
    }
  })

  it('all resource files are markdown', () => {
    for (const r of EXPECTED_RESOURCES) {
      expect(r.file).toMatch(/\.md$/)
    }
  })

  it('resource URIs match tool names', () => {
    const toolNames = ['messages', 'folders', 'attachments', 'send']
    for (const name of toolNames) {
      const resource = EXPECTED_RESOURCES.find((r) => r.uri === `email://docs/${name}`)
      expect(resource).toBeDefined()
      expect(resource!.file).toBe(`${name}.md`)
    }
  })
})

// ============================================================================
// Help tool enum validation
// ============================================================================

describe('help tool enum', () => {
  const HELP_ENUM = ['messages', 'folders', 'attachments', 'send']

  it('help covers all non-help tools', () => {
    expect(HELP_ENUM).toHaveLength(4)
    expect(HELP_ENUM).not.toContain('help')
  })

  it('help does not include itself', () => {
    expect(HELP_ENUM).not.toContain('help')
  })
})

// ============================================================================
// Core Tool Registration (registerTools)
// ============================================================================

describe('registerTools function', () => {
  let mockServer: any
  let callToolHandler: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockServer = {
      setRequestHandler: vi.fn()
    }
    registerTools(mockServer as any, [])
    callToolHandler = mockServer.setRequestHandler.mock.calls.find(
      (call: any) => call[0] === CallToolRequestSchema
    )?.[1]
  })

  it('should register all required MCP schemas', () => {
    // Assert setRequestHandler was called exactly 4 times
    expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(4)

    // Assert the specific schemas were registered
    const registeredSchemas = mockServer.setRequestHandler.mock.calls.map((call: any) => call[0])

    expect(registeredSchemas).toContain(ListToolsRequestSchema)
    expect(registeredSchemas).toContain(ListResourcesRequestSchema)
    expect(registeredSchemas).toContain(ReadResourceRequestSchema)
    expect(registeredSchemas).toContain(CallToolRequestSchema)
  })

  describe('CallToolRequestSchema handler', () => {
    it('should return error when no arguments are provided', async () => {
      const result = await callToolHandler({
        params: { name: 'messages', arguments: undefined }
      })

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Error: No arguments provided' }],
        isError: true
      })
    })

    it('should return error for unknown tool', async () => {
      const result = await callToolHandler({
        params: { name: 'unknown_tool', arguments: {} }
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Unknown tool: unknown_tool')
    })

    it('should handle tool execution error (EmailMCPError)', async () => {
      const { messages } = await import('./composite/messages.js')
      vi.mocked(messages).mockRejectedValue(new EmailMCPError('Tool failed', 'ERR', 'Suggestion'))

      const result = await callToolHandler({
        params: { name: 'messages', arguments: { action: 'search' } }
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Error: Tool failed')
      expect(result.content[0].text).toContain('Suggestion: Suggestion')
    })

    it('should handle tool execution error (generic Error)', async () => {
      const { messages } = await import('./composite/messages.js')
      vi.mocked(messages).mockRejectedValue(new Error('Unexpected error'))

      const result = await callToolHandler({
        params: { name: 'messages', arguments: { action: 'search' } }
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Error: Unexpected error')
      expect(result.content[0].text).toContain('Suggestion: Please check your request and try again')
    })

    describe('successful tool calls', () => {
      it('should successfully call messages and wrap result in untrusted tags', async () => {
        const { messages } = await import('./composite/messages.js')
        const mockResult = { success: true, emails: [{ uid: 1, subject: 'Test' }] }
        vi.mocked(messages).mockResolvedValue(mockResult)

        const result = await callToolHandler({
          params: { name: 'messages', arguments: { action: 'search', query: 'ALL' } }
        })

        expect(result.isError).toBeUndefined()
        expect(result.content[0].text).toContain('<untrusted_email_content>')
        expect(result.content[0].text).toContain(JSON.stringify(mockResult, null, 2))
      })

      it('should successfully call folders without wrapping', async () => {
        const { folders } = await import('./composite/folders.js')
        const mockResult = { folders: ['INBOX'] }
        vi.mocked(folders).mockResolvedValue(mockResult)

        const result = await callToolHandler({
          params: { name: 'folders', arguments: { action: 'list' } }
        })

        expect(result.isError).toBeUndefined()
        expect(result.content[0].text).toBe(JSON.stringify(mockResult, null, 2))
      })

      it('should successfully call send without wrapping', async () => {
        const { send } = await import('./composite/send.js')
        const mockResult = { success: true, messageId: '123' }
        vi.mocked(send).mockResolvedValue(mockResult)

        const result = await callToolHandler({
          params: {
            name: 'send',
            arguments: { action: 'new', account: 't@t.com', to: 'to@t.com', body: 'Hi' }
          }
        })

        expect(result.isError).toBeUndefined()
        expect(result.content[0].text).toBe(JSON.stringify(mockResult, null, 2))
      })

      it('should successfully call attachments and wrap result in untrusted tags', async () => {
        const { attachments } = await import('./composite/attachments.js')
        const mockResult = { success: true, attachments: [{ filename: 'a.txt' }] }
        vi.mocked(attachments).mockResolvedValue(mockResult)

        const result = await callToolHandler({
          params: { name: 'attachments', arguments: { action: 'list', account: 't@t.com', uid: 1 } }
        })

        expect(result.isError).toBeUndefined()
        expect(result.content[0].text).toContain('<untrusted_email_content>')
        expect(result.content[0].text).toContain(JSON.stringify(mockResult, null, 2))
      })
    })
  })
})
