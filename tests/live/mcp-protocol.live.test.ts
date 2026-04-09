/**
 * Live MCP Protocol Tests
 *
 * Spawns the actual MCP server via stdio and communicates using JSON-RPC
 * through the official MCP SDK client. Tests work WITHOUT EMAIL_CREDENTIALS
 * to verify plug-and-play UX.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const EXPECTED_TOOLS = ['messages', 'folders', 'attachments', 'send', 'setup', 'help']

const EMAIL_DEPENDENT_TOOLS = ['messages', 'folders', 'attachments', 'send']

describe('MCP Protocol - Live Server (no EMAIL_CREDENTIALS)', () => {
  let client: Client
  let transport: StdioClientTransport

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: 'node',
      args: ['bin/cli.mjs'],
      env: {
        PATH: process.env.PATH ?? '',
        HOME: process.env.HOME ?? '',
        NODE_ENV: 'test'
        // Intentionally NO EMAIL_CREDENTIALS
      },
      stderr: 'pipe'
    })
    client = new Client({ name: 'live-test', version: '1.0.0' })
    await client.connect(transport)
  }, 15_000)

  afterAll(async () => {
    await transport.close()
  })

  describe('Server initialization', () => {
    it('should connect and report server info', () => {
      const serverVersion = client.getServerVersion()
      expect(serverVersion).toBeDefined()
      expect(serverVersion?.name).toBe('@n24q02m/better-email-mcp')
      expect(serverVersion?.version).toMatch(/^\d+\.\d+\.\d+/)
    })

    it('should report tools capability', () => {
      const caps = client.getServerCapabilities()
      expect(caps).toBeDefined()
      expect(caps?.tools).toBeDefined()
    })

    it('should report resources capability', () => {
      const caps = client.getServerCapabilities()
      expect(caps?.resources).toBeDefined()
    })
  })

  describe('tools/list', () => {
    it('should return all 5 tools', async () => {
      const result = await client.listTools()
      const toolNames = result.tools.map((t) => t.name)
      expect(toolNames).toHaveLength(6)
      for (const name of EXPECTED_TOOLS) {
        expect(toolNames).toContain(name)
      }
    })

    it('should have valid inputSchema for each tool', async () => {
      const result = await client.listTools()
      for (const tool of result.tools) {
        expect(tool.inputSchema).toBeDefined()
        expect(tool.inputSchema.type).toBe('object')
        expect(tool.description).toBeTruthy()
      }
    })

    it('should have annotations on each tool', async () => {
      const result = await client.listTools()
      for (const tool of result.tools) {
        expect(tool.annotations).toBeDefined()
        expect(tool.annotations?.title).toBeTruthy()
      }
    })
  })

  describe('resources/list', () => {
    it('should return documentation resources', async () => {
      const result = await client.listResources()
      expect(result.resources.length).toBeGreaterThanOrEqual(5)
      for (const resource of result.resources) {
        expect(resource.uri).toMatch(/^email:\/\/docs\//)
        expect(resource.mimeType).toBe('text/markdown')
      }
    })
  })

  describe('help tool', () => {
    it('should return documentation for each tool', async () => {
      for (const toolName of EXPECTED_TOOLS) {
        const result = await client.callTool({ name: 'help', arguments: { tool_name: toolName } })
        expect(result.isError).toBeFalsy()
        const text = (result.content as Array<{ type: string; text: string }>)[0]?.text
        expect(text).toBeTruthy()
        expect(text).toContain(toolName)
      }
    })

    it('should return error for invalid tool name', async () => {
      const result = await client.callTool({ name: 'help', arguments: { tool_name: 'nonexistent' } })
      expect(result.isError).toBe(true)
      const text = (result.content as Array<{ type: string; text: string }>)[0]?.text
      expect(text).toContain('Invalid tool name')
    })
  })

  describe('Email-dependent tools return setup hints without credentials', () => {
    for (const toolName of EMAIL_DEPENDENT_TOOLS) {
      it(`${toolName} should return no-accounts error with setup instructions`, async () => {
        const actionMap: Record<string, Record<string, unknown>> = {
          messages: { action: 'search' },
          folders: { action: 'list' },
          attachments: { action: 'list', account: 'test@test.com', uid: 1 },
          send: { action: 'new', account: 'test@test.com', to: 'a@b.com', subject: 'test', body: 'test' }
        }

        const result = await client.callTool({
          name: toolName,
          arguments: actionMap[toolName]
        })
        expect(result.isError).toBe(true)
        const text = (result.content as Array<{ type: string; text: string }>)[0]?.text
        expect(text).toBeTruthy()
        expect(text).toContain('No email accounts configured')
        expect(text).toContain('EMAIL_CREDENTIALS')
      })
    }
  })

  describe('unknown tool handling', () => {
    it('should return error for unknown tool', async () => {
      const result = await client.callTool({
        name: 'nonexistent_tool',
        arguments: { action: 'test' }
      })
      expect(result.isError).toBe(true)
      const text = (result.content as Array<{ type: string; text: string }>)[0]?.text
      expect(text).toContain('Unknown tool')
    })
  })

  describe('no arguments handling', () => {
    it('should return error when no arguments provided', async () => {
      const result = await client.callTool({
        name: 'messages',
        arguments: undefined as any
      })
      expect(result.isError).toBe(true)
      const text = (result.content as Array<{ type: string; text: string }>)[0]?.text
      expect(text).toContain('No arguments provided')
    })
  })

  describe('ping', () => {
    it('should respond to ping', async () => {
      const result = await client.ping()
      expect(result).toBeDefined()
    })
  })
})
