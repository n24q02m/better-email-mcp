import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import { initServer } from './init-server.js'
import { loadConfig } from './tools/helpers/config.js'
import { registerTools } from './tools/registry.js'

// Mock dependencies
vi.mock('./tools/helpers/config.js', () => ({
  loadConfig: vi.fn(),
  resolveAccount: vi.fn(),
  resolveAccounts: vi.fn()
}))
vi.mock('./tools/registry.js', () => ({
  registerTools: vi.fn()
}))
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn()
}))
vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn()
}))

describe('initServer', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock process.exit
    // @ts-expect-error
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`process.exit: ${code}`)
    })

    // Mock console.error to suppress output
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Default mock implementation for Server
    // biome-ignore lint/complexity/useArrowFunction: Must use function for constructor mocking
    ;(Server as unknown as Mock).mockImplementation(function () {
      return {
        connect: vi.fn().mockResolvedValue(undefined)
      }
    })

    // Default mock implementation for StdioServerTransport
    // biome-ignore lint/complexity/useArrowFunction: Must use function for constructor mocking
    ;(StdioServerTransport as unknown as Mock).mockImplementation(function () {
      return {}
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes server successfully when accounts are loaded', async () => {
    // Setup mocks
    const mockAccounts = [{ email: 'test@example.com' }]
    vi.mocked(loadConfig).mockReturnValue(mockAccounts as any)

    // Execute
    const server = await initServer()

    // Verify
    expect(loadConfig).toHaveBeenCalled()
    expect(Server).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '@n24q02m/better-email-mcp'
      }),
      expect.any(Object)
    )
    expect(registerTools).toHaveBeenCalledWith(server, mockAccounts)
    expect(StdioServerTransport).toHaveBeenCalled()
    expect(server.connect).toHaveBeenCalledWith(expect.anything())
  })

  it('exits process if no accounts are loaded', async () => {
    // Setup mocks
    vi.mocked(loadConfig).mockReturnValue([])

    // Execute & Verify
    await expect(initServer()).rejects.toThrow('process.exit: 1')

    expect(loadConfig).toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith('EMAIL_CREDENTIALS environment variable is required')
    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(Server).not.toHaveBeenCalled()
  })
})
