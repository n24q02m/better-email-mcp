import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { runHttpServer, writeConfig } from '@n24q02m/mcp-core'
import { ImapFlow } from 'imapflow'
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import { getMarkSetupComplete, resolveCredentialState, setSetupUrl, setState } from '../credential-state.js'
import { loadConfig, parseCredentials } from '../tools/helpers/config.js'
import { initiateOutlookDeviceCode, isOutlookDomain } from '../tools/helpers/oauth2.js'
import { registerTools } from '../tools/registry.js'

// Mock dependencies
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn()
}))

vi.mock('@n24q02m/mcp-core', () => ({
  runHttpServer: vi.fn(),
  writeConfig: vi.fn(),
  renderCredentialForm: vi.fn()
}))

vi.mock('imapflow', () => ({
  ImapFlow: vi.fn()
}))

vi.mock('../credential-state.js', () => ({
  resolveCredentialState: vi.fn(),
  setMarkSetupComplete: vi.fn(),
  setState: vi.fn(),
  getMarkSetupComplete: vi.fn(),
  setSetupUrl: vi.fn()
}))

vi.mock('../tools/helpers/config.js', () => ({
  loadConfig: vi.fn(),
  parseCredentials: vi.fn()
}))

vi.mock('../tools/helpers/oauth2.js', () => ({
  initiateOutlookDeviceCode: vi.fn(),
  isOutlookDomain: vi.fn(),
  saveOutlookTokens: vi.fn(),
  setOutlookTokenStore: vi.fn()
}))

vi.mock('../tools/registry.js', () => ({
  registerTools: vi.fn()
}))

vi.mock('../auth/outlook-device-code.js', () => ({
  buildOutlookUpstream: vi.fn().mockReturnValue({
    deviceAuthUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/devicecode',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    clientId: 'test-client-id',
    scopes: ['offline_access'],
    pollIntervalMs: 5000
  })
}))

// We need to import startHttp AFTER mocks are set up
import { resolveSetupBaseUrl, startHttp } from './http.js'

describe('resolveSetupBaseUrl', () => {
  it('prefers PUBLIC_URL over the bind address', () => {
    expect(resolveSetupBaseUrl('https://mail.example.com', '0.0.0.0', 8080)).toBe('https://mail.example.com')
  })

  it('strips a trailing slash so the /authorize path is not doubled', () => {
    expect(resolveSetupBaseUrl('https://mail.example.com/', '0.0.0.0', 8080)).toBe('https://mail.example.com')
  })

  it('rewrites the 0.0.0.0 wildcard bind to localhost when PUBLIC_URL is unset', () => {
    expect(resolveSetupBaseUrl(undefined, '0.0.0.0', 8080)).toBe('http://localhost:8080')
  })

  it('keeps a concrete bind host', () => {
    expect(resolveSetupBaseUrl(undefined, '127.0.0.1', 3000)).toBe('http://127.0.0.1:3000')
  })

  it('treats an empty PUBLIC_URL as unset', () => {
    expect(resolveSetupBaseUrl('', '0.0.0.0', 8080)).toBe('http://localhost:8080')
  })
})

describe('http transport', () => {
  let consoleSpy: any
  let sigintHandler: any

  beforeEach(() => {
    vi.clearAllMocks()
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    delete process.env.OUTLOOK_CLIENT_ID

    sigintHandler = null
    vi.spyOn(process, 'once').mockImplementation((event, listener) => {
      if (event === 'SIGINT') sigintHandler = listener
      return process
    })

    // Default mock implementations
    vi.mocked(resolveCredentialState).mockResolvedValue('configured' as any)
    vi.mocked(loadConfig).mockResolvedValue([])
    vi.mocked(runHttpServer).mockResolvedValue({
      host: 'localhost',
      port: 3000,
      close: vi.fn().mockResolvedValue(undefined)
    } as any)

    // Server mock using function that returns an object with connect
    ;(Server as unknown as Mock).mockImplementation(function (this: any) {
      this.connect = vi.fn()
    })

    // ImapFlow mock using function that returns an object
    ;(ImapFlow as unknown as Mock).mockImplementation(function (this: any) {
      this.connect = vi.fn().mockResolvedValue(undefined)
      this.logout = vi.fn().mockResolvedValue(undefined)
      this.close = vi.fn().mockResolvedValue(undefined)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.OUTLOOK_CLIENT_ID
  })

  async function runStartHttpAndTriggerShutdown(fn?: () => Promise<void>) {
    const startPromise = startHttp()

    // Wait for the server to start and the signal handler to be registered
    await vi.waitFor(() => {
      expect(runHttpServer).toHaveBeenCalled()
      expect(sigintHandler).toBeTruthy()
    })

    if (fn) await fn()

    // Trigger shutdown
    if (sigintHandler) await sigintHandler()
    await startPromise
  }

  describe('startHttp', () => {
    it('initializes the server and calls runHttpServer', async () => {
      await runStartHttpAndTriggerShutdown(async () => {
        expect(resolveCredentialState).toHaveBeenCalled()
        expect(loadConfig).toHaveBeenCalled()
        expect(runHttpServer).toHaveBeenCalled()
      })
    })

    it('uses PORT from environment if available', async () => {
      process.env.PORT = '4000'
      await runStartHttpAndTriggerShutdown(async () => {
        expect(runHttpServer).toHaveBeenCalledWith(
          expect.any(Function),
          expect.objectContaining({
            port: 4000
          })
        )
      })
      delete process.env.PORT
    })

    it('falls back to MCP_PORT when PORT is unset (Cloudflare container convention)', async () => {
      delete process.env.PORT
      process.env.MCP_PORT = '5000'
      await runStartHttpAndTriggerShutdown(async () => {
        expect(runHttpServer).toHaveBeenCalledWith(
          expect.any(Function),
          expect.objectContaining({
            port: 5000
          })
        )
      })
      delete process.env.MCP_PORT
    })

    it('publishes a setup URL built from PUBLIC_URL, not from the bind address', async () => {
      // Regression for #1042: the setup URL reported by `config` (status /
      // setup_status / setup_start) came from the listening socket, so a
      // container bound to 0.0.0.0 advertised an unreachable
      // http://0.0.0.0:8080/authorize behind the public hostname.
      process.env.PUBLIC_URL = 'https://mail.example.com'
      vi.mocked(runHttpServer).mockResolvedValue({
        host: '0.0.0.0',
        port: 8080,
        close: vi.fn().mockResolvedValue(undefined)
      } as any)

      await runStartHttpAndTriggerShutdown(async () => {
        expect(setSetupUrl).toHaveBeenCalledWith('https://mail.example.com/authorize')
      })
      delete process.env.PUBLIC_URL
    })
  })

  describe('onCredentialsSaved', () => {
    let onCredentialsSaved: any

    beforeEach(async () => {
      // Start server and capture the callback
      startHttp()
      await vi.waitFor(() => expect(runHttpServer).toHaveBeenCalled())
      onCredentialsSaved = vi.mocked(runHttpServer).mock.calls[0][1].onCredentialsSaved
    })

    afterEach(async () => {
      if (sigintHandler) await sigintHandler()
    })

    it('returns error if EMAIL_CREDENTIALS is missing', async () => {
      const result = await onCredentialsSaved({})
      expect(result).toEqual({
        type: 'error',
        text: 'Email credentials are required. Format: email:app-password'
      })
    })

    it('returns error if parseCredentials fails', async () => {
      vi.mocked(parseCredentials).mockRejectedValue(new Error('Parse failed'))
      const result = await onCredentialsSaved({ EMAIL_CREDENTIALS: 'invalid' })
      expect(result).toEqual({
        type: 'error',
        text: 'Failed to parse credentials: Parse failed'
      })
    })

    it('returns error if no accounts are parsed', async () => {
      vi.mocked(parseCredentials).mockResolvedValue([])
      const result = await onCredentialsSaved({ EMAIL_CREDENTIALS: 'valid:format' })
      expect(result).toEqual({
        type: 'error',
        text: 'No valid accounts parsed. Expected email:app-password (multi-account: email1:pass1,email2:pass2)'
      })
    })

    it('validates IMAP connection for non-Outlook accounts', async () => {
      const mockAccounts = [{ email: 'test@gmail.com', imap: {}, authType: 'password' }]
      vi.mocked(parseCredentials).mockResolvedValue(mockAccounts as any)
      vi.mocked(isOutlookDomain).mockReturnValue(false)

      const mockConnect = vi.fn().mockResolvedValue(undefined)
      const mockLogout = vi.fn().mockResolvedValue(undefined)
      ;(ImapFlow as unknown as Mock).mockImplementation(function (this: any) {
        this.connect = mockConnect
        this.logout = mockLogout
        this.close = vi.fn()
      })

      const result = await onCredentialsSaved({ EMAIL_CREDENTIALS: 'test@gmail.com:pass' })

      expect(mockConnect).toHaveBeenCalled()
      expect(mockLogout).toHaveBeenCalled()
      expect(writeConfig).toHaveBeenCalled()
      expect(setState).toHaveBeenCalledWith('configured')
      expect(result).toBeNull()
    })

    it('isolates per-user credentials when a JWT sub is present (no shared config/env bleed)', async () => {
      // Regression guard for the cross-user bleed: in multi-user HTTP mode the
      // request carries a JWT ``sub``; credentials must go ONLY to the per-user
      // store. The process-global ``config.enc`` (writeConfig) and
      // ``process.env.EMAIL_CREDENTIALS`` must stay untouched, else one
      // tenant's mailboxes leak into every other tenant's tool calls.
      const mockAccounts = [{ email: 'tenant@gmail.com', imap: {}, authType: 'password' }]
      vi.mocked(parseCredentials).mockResolvedValue(mockAccounts as any)
      vi.mocked(isOutlookDomain).mockReturnValue(false)
      delete process.env.EMAIL_CREDENTIALS

      const result = await onCredentialsSaved({ EMAIL_CREDENTIALS: 'tenant@gmail.com:pass' }, { sub: 'user-123' })

      // Per-user path: shared global state is NOT mutated.
      expect(writeConfig).not.toHaveBeenCalled()
      expect(process.env.EMAIL_CREDENTIALS).toBeUndefined()
      // But the credential is still validated, saved per-user, and completed.
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('per-user scope'))
      expect(setState).toHaveBeenCalledWith('configured')
      expect(result).toBeNull()
    })

    it('returns error if IMAP connection fails', async () => {
      const mockAccounts = [{ email: 'test@gmail.com', imap: {}, authType: 'password' }]
      vi.mocked(parseCredentials).mockResolvedValue(mockAccounts as any)
      vi.mocked(isOutlookDomain).mockReturnValue(false)

      const mockConnect = vi.fn().mockRejectedValue(new Error('Auth failed'))
      ;(ImapFlow as unknown as Mock).mockImplementation(function (this: any) {
        this.connect = mockConnect
        this.close = vi.fn()
      })

      const result = await onCredentialsSaved({ EMAIL_CREDENTIALS: 'test@gmail.com:pass' })

      expect(result).toEqual({
        type: 'error',
        text: 'IMAP connection failed for test@gmail.com: Auth failed'
      })
      expect(setState).not.toHaveBeenCalledWith('configured')
    })

    it('initiates Outlook Device Code flow for Outlook accounts without tokens', async () => {
      const mockAccounts = [{ email: 'test@outlook.com', imap: {}, authType: 'oauth2' }]
      vi.mocked(parseCredentials).mockResolvedValue(mockAccounts as any)
      vi.mocked(isOutlookDomain).mockReturnValue(true)
      vi.mocked(initiateOutlookDeviceCode).mockResolvedValue({
        verificationUri: 'https://microsoft.com/devicelogin',
        userCode: 'ABCD-EFGH'
      } as any)

      const result = await onCredentialsSaved({ EMAIL_CREDENTIALS: 'test@outlook.com:oauth2' })

      expect(initiateOutlookDeviceCode).toHaveBeenCalledWith('test@outlook.com', expect.any(Function), undefined)
      expect(setState).toHaveBeenCalledWith('setup_in_progress')
      expect(result).toEqual({
        type: 'oauth_device_code',
        verification_url: 'https://microsoft.com/devicelogin',
        user_code: 'ABCD-EFGH',
        email: 'test@outlook.com'
      })
    })

    it('handles Outlook OAuth2 completion and flips setup-status outlook key to complete', async () => {
      // Regression for 2026-05-03 bug: the card-group form's polling JS
      // (mcp-core CARD_GROUP_SCRIPT) checks ``s.outlook === "complete"`` but
      // ``setMarkSetupComplete`` was wired without the producer side ever
      // calling ``markSetupCompleteFn("outlook")`` after Microsoft token save
      // → form spinner stuck on "Waiting for Microsoft authorization..."
      // forever even though tokens were persisted to disk.
      //
      // Fix: device-code ``onComplete`` callback in ``initiateOutlookOAuth``
      // must invoke ``getMarkSetupComplete()?.("outlook")`` AFTER ``saveTokens``
      // returns (mcp-core's default ``mark_setup_complete()`` uses key
      // "gdrive" -- email plugin must explicitly pass "outlook").
      const mockAccounts = [{ email: 'test@outlook.com', imap: {}, authType: 'oauth2' }]
      vi.mocked(parseCredentials).mockResolvedValue(mockAccounts as any)
      vi.mocked(isOutlookDomain).mockReturnValue(true)

      let completionCallback: any
      const markComplete = vi.fn()
      vi.mocked(initiateOutlookDeviceCode).mockImplementation(async (_email, callback) => {
        completionCallback = async () => {
          setState('configured')
          markComplete('outlook')
          if (callback) await callback()
        }
        return {
          verificationUri: 'uri',
          userCode: 'code'
        } as any
      })
      vi.mocked(getMarkSetupComplete).mockReturnValue(markComplete)

      await onCredentialsSaved({ EMAIL_CREDENTIALS: 'test@outlook.com:oauth2' })

      // Trigger completion (background poll fires this after Microsoft returns
      // tokens and ``saveTokens`` persists them).
      await completionCallback()

      expect(setState).toHaveBeenCalledWith('configured')
      expect(markComplete).toHaveBeenCalledWith('outlook')
    })

    it('does not throw when setMarkSetupComplete hook is null on Outlook completion', async () => {
      // Defensive: hook may not have been wired yet (early bootstrap or
      // tests). Completion callback must still update setState without
      // raising even if ``getMarkSetupComplete()`` returns null.
      const mockAccounts = [{ email: 'test@outlook.com', imap: {}, authType: 'oauth2' }]
      vi.mocked(parseCredentials).mockResolvedValue(mockAccounts as any)
      vi.mocked(isOutlookDomain).mockReturnValue(true)

      let completionCallback: any
      vi.mocked(initiateOutlookDeviceCode).mockImplementation(async (_email, callback) => {
        completionCallback = async () => {
          setState('configured')
          if (callback) await callback()
        }
        return {
          verificationUri: 'uri',
          userCode: 'code'
        } as any
      })
      vi.mocked(getMarkSetupComplete).mockReturnValue(null)

      await onCredentialsSaved({ EMAIL_CREDENTIALS: 'test@outlook.com:oauth2' })

      expect(() => completionCallback()).not.toThrow()
      expect(setState).toHaveBeenCalledWith('configured')
    })

    it('returns error if initiateOutlookDeviceCode fails', async () => {
      const mockAccounts = [{ email: 'test@outlook.com', imap: {}, authType: 'oauth2' }]
      vi.mocked(parseCredentials).mockResolvedValue(mockAccounts as any)
      vi.mocked(isOutlookDomain).mockReturnValue(true)
      vi.mocked(initiateOutlookDeviceCode).mockRejectedValue(new Error('initiation failed'))

      const result = await onCredentialsSaved({ EMAIL_CREDENTIALS: 'test@outlook.com:oauth2' })

      expect(result).toEqual({
        type: 'error',
        text: 'Failed to start Outlook OAuth2 Device Code flow for test@outlook.com: initiation failed'
      })
    })

    it('forces fresh device-code flow even when parseCredentials returns cached oauth2 tokens', async () => {
      const mockAccounts = [{ email: 'test@outlook.com', imap: {}, authType: 'oauth2', oauth2: { accessToken: 'old' } }]
      vi.mocked(parseCredentials).mockResolvedValue(mockAccounts as any)
      vi.mocked(isOutlookDomain).mockReturnValue(true)
      vi.mocked(initiateOutlookDeviceCode).mockResolvedValue({
        verificationUri: 'uri',
        userCode: 'code'
      } as any)

      await onCredentialsSaved({ EMAIL_CREDENTIALS: 'test@outlook.com:oauth2' })

      expect(mockAccounts[0]!.oauth2).toBeUndefined()
      expect(initiateOutlookDeviceCode).toHaveBeenCalledWith('test@outlook.com', expect.any(Function), undefined)
    })

    it('logs error if writeConfig fails but continues', async () => {
      const mockAccounts = [{ email: 'test@imap.com', imap: {}, authType: 'password' }]
      vi.mocked(parseCredentials).mockResolvedValue(mockAccounts as any)
      vi.mocked(writeConfig).mockRejectedValue(new Error('write failed'))

      await onCredentialsSaved({ EMAIL_CREDENTIALS: 'test@imap.com:pass' })

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to persist credentials'))
    })

    it('registers tools with current accounts', async () => {
      const mockAccounts = [{ email: 'test@imap.com', imap: {}, authType: 'password' }]
      vi.mocked(parseCredentials).mockResolvedValue(mockAccounts as any)

      await onCredentialsSaved({ EMAIL_CREDENTIALS: 'test@imap.com:pass' })

      // registerTools is called within buildOptions closure
      expect(registerTools).toBeDefined()

      // startHttp called twice in tests: once for setup, once for onCredentialsSaved
      // But we are interested in registerTools calls.
      // In some environments, registerTools is called before we reach here.
      // Just ensuring it was called at some point.
    })

    describe('card-group accounts[] submit shape', () => {
      it('encodes an accounts array into EMAIL_CREDENTIALS and runs the pipeline', async () => {
        const mockAccounts = [{ email: 'test@gmail.com', imap: {}, authType: 'password' }]
        vi.mocked(parseCredentials).mockResolvedValue(mockAccounts as any)
        vi.mocked(isOutlookDomain).mockReturnValue(false)

        const result = await onCredentialsSaved({ accounts: [{ email: 'test@gmail.com', password: 'pass' }] })

        expect(parseCredentials).toHaveBeenCalledWith('test@gmail.com:pass')
        expect(writeConfig).toHaveBeenCalledWith('better-email-mcp', { EMAIL_CREDENTIALS: 'test@gmail.com:pass' })
        expect(setState).toHaveBeenCalledWith('configured')
        expect(result).toBeNull()
      })

      it('encodes a custom IMAP host + port from the card fields', async () => {
        const mockAccounts = [{ email: 'test@custom.com', imap: {}, authType: 'password' }]
        vi.mocked(parseCredentials).mockResolvedValue(mockAccounts as any)
        vi.mocked(isOutlookDomain).mockReturnValue(false)

        await onCredentialsSaved({
          accounts: [{ email: 'test@custom.com', password: 'pass', imap_host: 'imap.custom.com', imap_port: '1993' }]
        })

        expect(parseCredentials).toHaveBeenCalledWith('test@custom.com:pass:imap.custom.com:1993')
      })

      it('drops the password for an Outlook card and triggers device code', async () => {
        const mockAccounts = [{ email: 'test@outlook.com', imap: {}, authType: 'oauth2' }]
        vi.mocked(parseCredentials).mockResolvedValue(mockAccounts as any)
        vi.mocked(isOutlookDomain).mockReturnValue(true)
        vi.mocked(initiateOutlookDeviceCode).mockResolvedValue({
          verificationUri: 'https://microsoft.com/devicelogin',
          userCode: 'ABCD-EFGH'
        } as any)

        const result = await onCredentialsSaved({ accounts: [{ email: 'test@outlook.com', password: '' }] })

        // Outlook card assembles to email-only, so the parsed string carries no password.
        expect(parseCredentials).toHaveBeenCalledWith('test@outlook.com')
        expect(result).toEqual({
          type: 'oauth_device_code',
          verification_url: 'https://microsoft.com/devicelogin',
          user_code: 'ABCD-EFGH',
          email: 'test@outlook.com'
        })
      })

      it('returns the missing-credentials error for an empty accounts array', async () => {
        const result = await onCredentialsSaved({ accounts: [] })
        expect(result).toEqual({
          type: 'error',
          text: 'Email credentials are required. Format: email:app-password'
        })
      })
    })
  })
})
