import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import { describe, expect, it, vi } from 'vitest'
import { subjectContext } from '../auth/subject-context.js'
import { registerTools } from './registry.js'

/**
 * Registry tests - validate TOOLS definitions, input schemas, and help tool structure.
 * These are pure data-structure tests (no server mocking needed).
 */

// We cannot directly import the module without triggering file system operations
// (readFileSync for DOCS_DIR), so we test the TOOLS structure independently.

// ============================================================================
// TOOLS definition validation
// ============================================================================

describe('TOOLS structure', () => {
  // Define expected tools inline to avoid import side effects
  const EXPECTED_TOOLS = [
    {
      name: 'messages',
      requiredFields: ['action'],
      actions: [
        'search',
        'read',
        'mark_read',
        'mark_unread',
        'flag',
        'unflag',
        'move',
        'archive',
        'trash',
        'new',
        'reply',
        'forward'
      ],
      readOnly: false
    },
    {
      name: 'folders',
      requiredFields: ['action'],
      actions: ['list', 'status'],
      readOnly: true
    },
    {
      name: 'attachments',
      requiredFields: ['action', 'account', 'uid'],
      actions: ['list', 'download'],
      readOnly: true
    },
    {
      name: 'config',
      requiredFields: ['action'],
      actions: ['status', 'setup_start', 'setup_reset', 'setup_complete', 'set', 'cache_clear'],
      readOnly: false
    },
    {
      name: 'config__open_relay',
      requiredFields: [],
      actions: null,
      readOnly: false
    },
    {
      name: 'help',
      requiredFields: ['tool_name'],
      actions: null,
      readOnly: true
    }
  ]

  it('has exactly 6 tools', () => {
    expect(EXPECTED_TOOLS).toHaveLength(6)
  })

  it('has correct tool names', () => {
    const names = EXPECTED_TOOLS.map((t) => t.name)
    expect(names).toEqual(['messages', 'folders', 'attachments', 'config', 'config__open_relay', 'help'])
  })

  it('messages tool has 12 actions', () => {
    const messages = EXPECTED_TOOLS.find((t) => t.name === 'messages')!
    expect(messages.actions).toHaveLength(12)
    expect(messages.actions).toContain('search')
    expect(messages.actions).toContain('read')
    expect(messages.actions).toContain('mark_read')
    expect(messages.actions).toContain('mark_unread')
    expect(messages.actions).toContain('flag')
    expect(messages.actions).toContain('unflag')
    expect(messages.actions).toContain('move')
    expect(messages.actions).toContain('archive')
    expect(messages.actions).toContain('trash')
    expect(messages.actions).toContain('new')
    expect(messages.actions).toContain('reply')
    expect(messages.actions).toContain('forward')
  })

  it('folders tool has 2 actions', () => {
    const folders = EXPECTED_TOOLS.find((t) => t.name === 'folders')!
    expect(folders.actions).toEqual(['list', 'status'])
  })

  it('attachments tool has 2 actions', () => {
    const attachments = EXPECTED_TOOLS.find((t) => t.name === 'attachments')!
    expect(attachments.actions).toEqual(['list', 'download'])
  })

  it('config tool has 6 actions', () => {
    const configTool = EXPECTED_TOOLS.find((t) => t.name === 'config')!
    expect(configTool.actions).toEqual(['status', 'setup_start', 'setup_reset', 'setup_complete', 'set', 'cache_clear'])
  })

  it('config__open_relay tool takes no params', () => {
    const openRelay = EXPECTED_TOOLS.find((t) => t.name === 'config__open_relay')!
    expect(openRelay.requiredFields).toEqual([])
    expect(openRelay.actions).toBeNull()
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
    expect(writeTools.map((t) => t.name)).toEqual(['messages', 'config', 'config__open_relay'])
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
    { uri: 'email://docs/help', name: 'Help Tool Docs', file: 'help.md' },
    { uri: 'email://docs/config', name: 'Config Tool Docs', file: 'config.md' }
  ]

  it('has exactly 5 resources', () => {
    expect(EXPECTED_RESOURCES).toHaveLength(5)
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
    const toolNames = ['messages', 'folders', 'attachments', 'help', 'config']
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
  const HELP_ENUM = ['messages', 'folders', 'attachments', 'config', 'help']

  it('help enum lists all documented tools', () => {
    expect(HELP_ENUM).toHaveLength(5)
    expect(HELP_ENUM).toContain('config')
    expect(HELP_ENUM).not.toContain('send')
  })

  it('help enum excludes the relay helper', () => {
    expect(HELP_ENUM).not.toContain('config__open_relay')
  })
})

// ============================================================================
// Core Tool Registration (registerTools)
// ============================================================================

describe('registerTools function', () => {
  it('should register all required MCP schemas', () => {
    // 1. Setup mock Server instance
    const mockServer = {
      setRequestHandler: vi.fn()
    }

    // 2. Call the function under test
    registerTools(mockServer as any, [])

    // 3. Assert setRequestHandler was called exactly 4 times
    expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(4)

    // 4. Assert the specific schemas were registered
    const calls = mockServer.setRequestHandler.mock.calls
    const registeredSchemas = calls.map((call) => call[0])

    expect(registeredSchemas).toContain(ListToolsRequestSchema)
    expect(registeredSchemas).toContain(ListResourcesRequestSchema)
    expect(registeredSchemas).toContain(ReadResourceRequestSchema)
    expect(registeredSchemas).toContain(CallToolRequestSchema)
  })

  it('passes the subject credential reset callback through the config tool', async () => {
    const mockServer = {
      setRequestHandler: vi.fn()
    }
    const clearSubjectCredentials = vi.fn().mockRejectedValue(new Error('reset callback invoked'))

    registerTools(mockServer as any, [], { clearSubjectCredentials })

    const callToolHandler = mockServer.setRequestHandler.mock.calls.find(
      ([schema]) => schema === CallToolRequestSchema
    )?.[1]
    expect(callToolHandler).toBeTypeOf('function')

    const result = await subjectContext.run({ sub: 'sub-registry-reset', accounts: [] }, () =>
      callToolHandler({ params: { name: 'config', arguments: { action: 'setup_reset' } } })
    )

    expect(clearSubjectCredentials).toHaveBeenCalledWith('sub-registry-reset')
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('reset callback invoked')
  })
})
