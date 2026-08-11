/**
 * Live MCP Protocol Tests
 *
 * Spawns the actual MCP server via stdio and communicates using JSON-RPC
 * through the official MCP SDK client.
 *
 * stdio mode REQUIRES credentials (`init-server.ts` exits with guidance when
 * they are absent — spec `2026-05-01-stdio-pure-http-multiuser.md` §5.2.1), so
 * the protocol suite runs with `EMAIL_CREDENTIALS` and is skipped without it.
 * The unconfigured path is covered separately below, against the real exit.
 */

import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/** Every tool the registry exposes (`src/tools/registry.ts` TOOLS). */
const EXPECTED_TOOLS = ['messages', 'folders', 'attachments', 'config', 'config__open_relay', 'help']

/** Tools carrying their own documentation resource (`email://docs/<name>`). */
const DOCUMENTED_TOOLS = ['messages', 'folders', 'attachments', 'config', 'help']

const EMAIL_CREDS = process.env.EMAIL_CREDENTIALS ?? ''

describe.skipIf(!EMAIL_CREDS)('MCP Protocol - Live Server (stdio)', () => {
  let client: Client
  let transport: StdioClientTransport

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: 'node',
      args: ['bin/cli.mjs'],
      env: {
        ...(process.env as Record<string, string>),
        EMAIL_CREDENTIALS: EMAIL_CREDS,
        NODE_ENV: 'test'
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
      expect(serverVersion?.name).toBe('better-email-mcp')
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
    it('should return every registered tool', async () => {
      const result = await client.listTools()
      const toolNames = result.tools.map((t) => t.name)
      expect(toolNames).toEqual(EXPECTED_TOOLS)
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
      expect(result.resources.map((resource) => resource.uri)).toEqual([
        'email://docs/messages',
        'email://docs/folders',
        'email://docs/attachments',
        'email://docs/help',
        'email://docs/config'
      ])
      for (const resource of result.resources) {
        expect(resource.uri).toMatch(/^email:\/\/docs\//)
        expect(resource.mimeType).toBe('text/markdown')
      }
    })
  })

  describe('help tool', () => {
    it('should return documentation for each documented tool', async () => {
      for (const toolName of DOCUMENTED_TOOLS) {
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

describe('stdio mode without credentials', () => {
  it('exits with actionable guidance instead of starting a server nobody can use', async () => {
    const { code, stderr } = await new Promise<{ code: number | null; stderr: string }>((done, fail) => {
      // Strip both credential shapes so the run is unconfigured regardless of
      // what the developer has exported locally.
      const { EMAIL_CREDENTIALS, EMAIL_USER, EMAIL_APP_PASSWORD, ...rest } = process.env
      const proc = spawn(process.execPath, [resolve(import.meta.dirname, '../../bin/cli.mjs')], {
        cwd: resolve(import.meta.dirname, '../..'),
        env: { ...rest, NODE_ENV: 'test' },
        stdio: ['ignore', 'pipe', 'pipe']
      })
      let err = ''
      proc.stderr.on('data', (chunk: Buffer) => {
        err += chunk.toString('utf8')
      })
      proc.once('error', fail)
      proc.once('exit', (exitCode) => done({ code: exitCode, stderr: err }))
    })

    expect(code).toBe(1)
    expect(stderr).toContain('Missing required env vars for stdio mode')
    expect(stderr).toContain('EMAIL_CREDENTIALS')
    expect(stderr).toContain('EMAIL_APP_PASSWORD')
    // The alternative path must stay discoverable: HTTP mode needs no env creds.
    expect(stderr).toContain('HTTP mode')
  }, 30_000)
})
