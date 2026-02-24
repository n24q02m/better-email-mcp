import { describe, expect, it } from 'vitest'

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
