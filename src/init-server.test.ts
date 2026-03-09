import { readFileSync } from 'node:fs'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import { initServer } from './init-server.js'
import { loadConfig } from './tools/helpers/config.js'
import { ensureValidToken } from './tools/helpers/oauth2.js'
import { registerTools } from './tools/registry.js'

// Mock dependencies
vi.mock('node:fs', () => ({
  readFileSync: vi.fn()
}))
vi.mock('./tools/helpers/config.js', () => ({
  loadConfig: vi.fn(),
  resolveAccount: vi.fn(),
  resolveAccounts: vi.fn()
}))
vi.mock('./tools/helpers/oauth2.js', () => ({
  ensureValidToken: vi.fn()
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

    // Default: readFileSync returns valid package.json with version
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ version: '1.0.0' }))

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

  it('uses fallback version 0.0.0 when package.json read fails', async () => {
    const mockAccounts = [{ email: 'test@example.com' }]
    vi.mocked(loadConfig).mockReturnValue(mockAccounts as any)
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error('File not found')
    })

    await initServer()

    expect(Server).toHaveBeenCalledWith(
      expect.objectContaining({
        version: '0.0.0'
      }),
      expect.any(Object)
    )
  })

  it('uses fallback version when package.json has no version field', async () => {
    const mockAccounts = [{ email: 'test@example.com' }]
    vi.mocked(loadConfig).mockReturnValue(mockAccounts as any)
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ name: 'test' }))

    await initServer()

    expect(Server).toHaveBeenCalledWith(
      expect.objectContaining({
        version: '0.0.0'
      }),
      expect.any(Object)
    )
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

  it('triggers proactive OAuth2 auth for Outlook accounts without tokens', async () => {
    const mockAccounts = [
      { email: 'user@outlook.com', authType: 'oauth2', oauth2: undefined },
      { email: 'user@gmail.com', authType: 'password' }
    ]
    vi.mocked(loadConfig).mockReturnValue(mockAccounts as any)
    vi.mocked(ensureValidToken).mockRejectedValue(
      new Error('Visit: https://microsoft.com/devicelogin\nEnter code: ABCD-EFGH')
    )

    await initServer()

    // ensureValidToken called only for Outlook account, not Gmail
    expect(ensureValidToken).toHaveBeenCalledTimes(1)
    expect(ensureValidToken).toHaveBeenCalledWith(mockAccounts[0])
    // Error message logged to stderr as fallback
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('ABCD-EFGH'))
  })

  it('skips proactive auth for Outlook accounts with existing tokens', async () => {
    const mockAccounts = [
      {
        email: 'user@outlook.com',
        authType: 'oauth2',
        oauth2: { accessToken: 'at', refreshToken: 'rt', expiresAt: 9999999999, clientId: 'cid' }
      }
    ]
    vi.mocked(loadConfig).mockReturnValue(mockAccounts as any)

    await initServer()

    // Should not call ensureValidToken — tokens already present
    expect(ensureValidToken).not.toHaveBeenCalled()
  })

  it('skips proactive auth for non-OAuth2 accounts', async () => {
    const mockAccounts = [{ email: 'user@gmail.com', authType: 'password' }]
    vi.mocked(loadConfig).mockReturnValue(mockAccounts as any)

    await initServer()

    expect(ensureValidToken).not.toHaveBeenCalled()
  })
})
