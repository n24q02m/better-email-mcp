import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runAuth } from '../src/auth-cli.js'
import { initServer } from '../src/init-server.js'

vi.mock('../src/auth-cli.js', () => ({
  runAuth: vi.fn()
}))

vi.mock('../src/init-server.js', () => ({
  initServer: vi.fn()
}))

describe('start-server', () => {
  const originalArgv = process.argv
  const originalExit = process.exit
  const originalConsoleError = console.error
  let processOnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    process.argv = ['node', 'scripts/start-server.ts']
    process.exit = vi.fn((_code) => {
      // Don't throw for tests, just capture
      return undefined as never
    }) as any
    console.error = vi.fn()
    processOnSpy = vi.spyOn(process, 'on').mockImplementation((_event, _listener) => process)
  })

  afterEach(() => {
    process.argv = originalArgv
    process.exit = originalExit
    console.error = originalConsoleError
    vi.restoreAllMocks()
  })

  it('calls runAuth and exits if argv[2] is "auth"', async () => {
    process.argv.push('auth')
    vi.mocked(runAuth).mockResolvedValue(undefined)

    // Dynamically import to execute main() again
    await import('./start-server.js')
    // Await macro task queue to ensure main finishes
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(runAuth).toHaveBeenCalled()
    expect(initServer).not.toHaveBeenCalled()
  })

  it('calls initServer and registers SIGINT handler if argv[2] is not "auth"', async () => {
    vi.mocked(initServer).mockResolvedValue(undefined)

    await import('./start-server.js')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(runAuth).not.toHaveBeenCalled()
    expect(initServer).toHaveBeenCalled()
    expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function))
  })

  it('handles SIGINT correctly', async () => {
    vi.mocked(initServer).mockResolvedValue(undefined)

    // We need to capture the SIGINT handler
    let sigintHandler: (() => void) | undefined
    processOnSpy.mockImplementation((event, listener) => {
      if (event === 'SIGINT') {
        sigintHandler = listener as () => void
      }
      return process
    })

    await import('./start-server.js')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(sigintHandler).toBeDefined()

    if (sigintHandler) {
      sigintHandler!()
      expect(console.error).toHaveBeenCalledWith('\nShutting down Better Email MCP Server')
      expect(process.exit).toHaveBeenCalledWith(0)
    }
  })

  it('exits with 1 if initServer throws', async () => {
    const error = new Error('Init failed')
    vi.mocked(initServer).mockRejectedValue(error)

    await import('./start-server.js')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(initServer).toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledWith('Failed to start server:', error)
    expect(process.exit).toHaveBeenCalledWith(1)
  })
})
