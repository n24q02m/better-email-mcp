import { existsSync, readFileSync } from 'node:fs'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createMcpServer, getVersion } from './server-factory.js'

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn()
}))

vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn()
}))

describe('server-factory', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // @ts-ignore
    Server.mockImplementation(function(info, options) {
      this.info = info;
      this.options = options;
    })
  })

  describe('getVersion', () => {
    it('returns version from package.json if found', () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ name: '@n24q02m/better-email-mcp', version: '1.2.3' }))

      const version = getVersion()
      expect(version).toBe('1.2.3')
    })

    it('returns 0.0.0 if package.json not found', () => {
      vi.mocked(existsSync).mockReturnValue(false)

      const version = getVersion()
      expect(version).toBe('0.0.0')
    })

    it('returns 0.0.0 if package.json is invalid', () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue('invalid json')

      const version = getVersion()
      expect(version).toBe('0.0.0')
    })
  })

  describe('createMcpServer', () => {
    it('creates a server with correct name and version', () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ name: '@n24q02m/better-email-mcp', version: '1.2.3' }))

      const server = createMcpServer() as any
      expect(Server).toHaveBeenCalled()
      expect(server.info.name).toBe('@n24q02m/better-email-mcp')
      expect(server.info.version).toBe('1.2.3')
      expect(server.options.capabilities).toEqual({
        tools: {},
        resources: {}
      })
    })
  })
})
