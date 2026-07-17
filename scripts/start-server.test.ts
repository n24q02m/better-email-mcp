import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setHomeDirForTesting } from '@n24q02m/mcp-core/storage'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runAuth, runLogout } from '../src/auth-cli.js'
import { initServer } from '../src/init-server.js'

vi.mock('../src/auth-cli.js', () => ({
  runAuth: vi.fn(),
  runLogout: vi.fn()
}))

vi.mock('../src/init-server.js', () => ({
  initServer: vi.fn(),
  getVersion: vi.fn(() => '0.0.0-test')
}))

describe('start-server (buildCli wiring)', () => {
  const originalArgv = process.argv
  const originalExit = process.exit
  const originalConsoleError = console.error
  let onceSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    setHomeDirForTesting(mkdtempSync(join(tmpdir(), 'better-email-mcp-cli-test-')))

    process.argv = ['node', 'scripts/start-server.ts']
    process.exit = vi.fn((_code) => undefined as never) as any
    console.error = vi.fn()
    onceSpy = vi.spyOn(process, 'once').mockImplementation((_event, _listener) => process)
  })

  afterEach(() => {
    process.argv = originalArgv
    process.exit = originalExit
    console.error = originalConsoleError
    setHomeDirForTesting(null)
    vi.restoreAllMocks()
  })

  it('routes the "auth" subcommand to runAuth and does not start the server', async () => {
    process.argv.push('auth')
    vi.mocked(runAuth).mockResolvedValue(undefined)

    await import('./start-server.js')
    await vi.waitFor(() => expect(runAuth).toHaveBeenCalled())

    expect(runAuth).toHaveBeenCalled()
    expect(initServer).not.toHaveBeenCalled()
    expect(process.exit).toHaveBeenCalledWith(0)
  })

  it('routes the "logout" subcommand to runLogout and does not start the server', async () => {
    process.argv.push('logout')
    vi.mocked(runLogout).mockResolvedValue(undefined)

    await import('./start-server.js')
    await vi.waitFor(() => expect(runLogout).toHaveBeenCalled())

    expect(runLogout).toHaveBeenCalled()
    expect(initServer).not.toHaveBeenCalled()
    expect(process.exit).toHaveBeenCalledWith(0)
  })

  it('starts the server and registers SIGINT/SIGTERM when no subcommand is given', async () => {
    vi.mocked(initServer).mockResolvedValue(undefined as any)

    await import('./start-server.js')
    await vi.waitFor(() => expect(initServer).toHaveBeenCalled())

    expect(runAuth).not.toHaveBeenCalled()
    expect(initServer).toHaveBeenCalled()
    expect(onceSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function))
    expect(onceSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function))
  })

  it('does not exit right after initServer resolves (stdio must stay alive until shutdown)', async () => {
    // Regression guard: Server.connect() (inside initServer) resolves once
    // the transport starts listening, not once the session ends. If
    // `serve()` returned right there, buildCli's own
    // `.then((code) => process.exit(code))` would kill the process
    // immediately after startup instead of keeping the server running.
    vi.mocked(initServer).mockResolvedValue(undefined as any)

    await import('./start-server.js')
    await vi.waitFor(() => expect(initServer).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(process.exit).not.toHaveBeenCalled()
  })

  it('exits 0 once SIGINT fires after the server starts', async () => {
    vi.mocked(initServer).mockResolvedValue(undefined as any)

    let sigintHandler: (() => void) | undefined
    onceSpy.mockImplementation((event: string, listener: (...args: any[]) => void) => {
      if (event === 'SIGINT') sigintHandler = listener as () => void
      return process
    })

    await import('./start-server.js')
    await vi.waitFor(() => expect(initServer).toHaveBeenCalled())
    await vi.waitFor(() => expect(sigintHandler).toBeDefined())

    sigintHandler?.()
    await vi.waitFor(() => expect(process.exit).toHaveBeenCalled())

    expect(console.error).toHaveBeenCalledWith('\nShutting down Better Email MCP Server')
    expect(process.exit).toHaveBeenCalledWith(0)
  })

  it('exits with 1 if initServer throws', async () => {
    const error = new Error('Init failed')
    vi.mocked(initServer).mockRejectedValue(error)

    await import('./start-server.js')
    await vi.waitFor(() => expect(initServer).toHaveBeenCalled())
    await vi.waitFor(() => expect(process.exit).toHaveBeenCalled())

    expect(console.error).toHaveBeenCalledWith('Failed to start server:', error)
    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it('does not start the server for --http (isHttp resolves immediately, no SIGINT wait)', async () => {
    process.argv.push('--http')
    vi.mocked(initServer).mockResolvedValue(undefined as any)

    await import('./start-server.js')
    await vi.waitFor(() => expect(initServer).toHaveBeenCalled())
    await vi.waitFor(() => expect(process.exit).toHaveBeenCalledWith(0))

    // http mode's initServer() already blocks until its own shutdown
    // completes (transports/http.ts), so serve() must not add a redundant
    // SIGINT wait -- that would hang the process after a graceful http
    // shutdown, since the http path's own `process.once('SIGINT', ...)`
    // handler already consumed the signal.
    expect(onceSpy).not.toHaveBeenCalled()
  })

  it('prints version and exits 0 without starting the server', async () => {
    process.argv.push('--version')
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await import('./start-server.js')
    await vi.waitFor(() => expect(process.exit).toHaveBeenCalled())

    expect(logSpy).toHaveBeenCalledWith('better-email-mcp 0.0.0-test')
    expect(process.exit).toHaveBeenCalledWith(0)
    expect(initServer).not.toHaveBeenCalled()
    logSpy.mockRestore()
  })

  it('routes config status to the built-in handler (isolated store dir: not configured)', async () => {
    process.argv.push('config', 'status')
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await import('./start-server.js')
    await vi.waitFor(() => expect(process.exit).toHaveBeenCalled())

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('better-email-mcp: not configured'))
    expect(process.exit).toHaveBeenCalledWith(0)
    expect(initServer).not.toHaveBeenCalled()
    logSpy.mockRestore()
  })
})
