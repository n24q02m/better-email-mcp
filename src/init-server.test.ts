import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const startHttpMock = vi.fn()
const runSmartStdioProxyMock = vi.fn().mockResolvedValue(0)

vi.mock('./transports/http.js', () => ({
  startHttp: startHttpMock
}))

vi.mock('@n24q02m/mcp-core/transport', () => ({
  runSmartStdioProxy: runSmartStdioProxyMock
}))

const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)

describe('initServer', () => {
  const originalEnv = process.env
  const originalArgv = process.argv

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
    process.argv = [...originalArgv]
    delete process.env.MCP_TRANSPORT
    delete process.env.TRANSPORT_MODE
  })

  afterEach(() => {
    process.env = originalEnv
    process.argv = originalArgv
  })

  it('dispatches stdio proxy when --stdio flag is set', async () => {
    process.argv = [process.argv[0], 'main.js', '--stdio']
    const { initServer } = await import('./init-server.js')
    await initServer()
    expect(runSmartStdioProxyMock).toHaveBeenCalledWith(
      'better-email-mcp',
      expect.any(Array),
      expect.objectContaining({ env: expect.objectContaining({ TRANSPORT_MODE: 'http', MCP_MODE: 'local-relay' }) })
    )
    expect(exitSpy).toHaveBeenCalledWith(0)
    expect(startHttpMock).not.toHaveBeenCalled()
  })

  it('dispatches stdio proxy when MCP_TRANSPORT=stdio', async () => {
    process.env.MCP_TRANSPORT = 'stdio'
    const { initServer } = await import('./init-server.js')
    await initServer()
    expect(runSmartStdioProxyMock).toHaveBeenCalled()
    expect(startHttpMock).not.toHaveBeenCalled()
  })

  it('dispatches stdio proxy when TRANSPORT_MODE=stdio', async () => {
    process.env.TRANSPORT_MODE = 'stdio'
    const { initServer } = await import('./init-server.js')
    await initServer()
    expect(runSmartStdioProxyMock).toHaveBeenCalled()
    expect(startHttpMock).not.toHaveBeenCalled()
  })

  it('dispatches http by default', async () => {
    const { initServer } = await import('./init-server.js')
    await initServer()
    expect(startHttpMock).toHaveBeenCalled()
    expect(runSmartStdioProxyMock).not.toHaveBeenCalled()
  })
})
