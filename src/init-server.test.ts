import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const startHttpMock = vi.fn()
const connectMock = vi.fn().mockResolvedValue(undefined)
const ServerCtorMock = vi.fn(function (this: any, _info: unknown, _opts: unknown) {
  this.connect = connectMock
  this.setRequestHandler = vi.fn()
})
const StdioServerTransportCtorMock = vi.fn(function (this: any) {})
const registerToolsMock = vi.fn()
const resolveCredentialStateMock = vi.fn().mockResolvedValue('configured')
const loadConfigMock = vi.fn().mockResolvedValue([])

vi.mock('./transports/http.js', () => ({
  startHttp: startHttpMock
}))

vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: ServerCtorMock
}))

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: StdioServerTransportCtorMock
}))

vi.mock('./tools/registry.js', () => ({
  registerTools: registerToolsMock
}))

vi.mock('./credential-state.js', () => ({
  resolveCredentialState: resolveCredentialStateMock
}))

vi.mock('./tools/helpers/config.js', () => ({
  loadConfig: loadConfigMock
}))

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

  it('connects StdioServerTransport when --stdio flag is set', async () => {
    process.argv = [process.argv[0], 'main.js', '--stdio']
    const { initServer } = await import('./init-server.js')
    await initServer()
    expect(ServerCtorMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'better-email-mcp' }),
      expect.objectContaining({ capabilities: expect.any(Object) })
    )
    expect(registerToolsMock).toHaveBeenCalled()
    expect(StdioServerTransportCtorMock).toHaveBeenCalled()
    expect(connectMock).toHaveBeenCalled()
    expect(startHttpMock).not.toHaveBeenCalled()
  })

  it('connects StdioServerTransport when MCP_TRANSPORT=stdio', async () => {
    process.env.MCP_TRANSPORT = 'stdio'
    const { initServer } = await import('./init-server.js')
    await initServer()
    expect(connectMock).toHaveBeenCalled()
    expect(startHttpMock).not.toHaveBeenCalled()
  })

  it('connects StdioServerTransport when TRANSPORT_MODE=stdio', async () => {
    process.env.TRANSPORT_MODE = 'stdio'
    const { initServer } = await import('./init-server.js')
    await initServer()
    expect(connectMock).toHaveBeenCalled()
    expect(startHttpMock).not.toHaveBeenCalled()
  })

  it('dispatches http by default', async () => {
    const { initServer } = await import('./init-server.js')
    await initServer()
    expect(startHttpMock).toHaveBeenCalled()
    expect(connectMock).not.toHaveBeenCalled()
  })
})
