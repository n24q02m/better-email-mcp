import { existsSync, readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getVersion, createMcpServer } from './server-factory.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { registerTools } from './tools/registry.js'

vi.mock('node:fs')
vi.mock('./tools/registry.js')
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn().mockImplementation(function () {
    return {
      capabilities: {}
    }
  })
}))

describe('server-factory', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
    delete process.env.npm_package_version
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('getVersion', () => {
    it('uses npm_package_version if available', () => {
      process.env.npm_package_version = '1.2.3'
      expect(getVersion()).toBe('1.2.3')
    })

    it('crawls filesystem for package.json if env var not set', () => {
      // Simulate package.json in parent directory
      vi.mocked(existsSync).mockImplementation((path: any) => path.toString().endsWith('package.json'))
      vi.mocked(readFileSync).mockImplementation((path: any) => {
        if (path.toString().endsWith('package.json')) {
          return JSON.stringify({
            name: '@n24q02m/better-email-mcp',
            version: '2.0.0'
          })
        }
        throw new Error('File not found')
      })

      expect(getVersion()).toBe('2.0.0')
    })

    it('returns 0.0.0 if package.json not found in crawl', () => {
      vi.mocked(existsSync).mockReturnValue(false)
      expect(getVersion()).toBe('0.0.0')
    })
  })

  describe('createMcpServer', () => {
    it('instantiates Server and registers tools', () => {
      const accounts = [{ email: 'test@example.com' }] as any
      const server = createMcpServer(accounts)

      expect(Server).toHaveBeenCalled()
      expect(registerTools).toHaveBeenCalledWith(server, accounts)
    })
  })
})
