import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { runHttpServer, writeConfig } from '@n24q02m/mcp-core'
import { ImapFlow } from 'imapflow'
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import { resolveCredentialState, setState } from '../credential-state.js'
import { loadConfig, parseCredentials } from '../tools/helpers/config.js'
import { initiateOutlookDeviceCode, isOutlookDomain } from '../tools/helpers/oauth2.js'
import { registerTools } from '../tools/registry.js'

// Mock dependencies
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn()
}))

vi.mock('@n24q02m/mcp-core', () => ({
  runHttpServer: vi.fn(),
  writeConfig: vi.fn()
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
  saveOutlookTokens: vi.fn()
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
import { startHttp } from './http.js'

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

    // Give it some time to run up to the signal wait
    await new Promise((resolve) => setTimeout(resolve, 50))

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
  })

  describe('onCredentialsSaved', () => {
    let onCredentialsSaved: any

    beforeEach(async () => {
      // Start server and capture the callback
      startHttp()
      await new Promise((resolve) => setTimeout(resolve, 50))
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

      expect(initiateOutlookDeviceCode).toHaveBeenCalledWith('test@outlook.com', expect.any(Function))
      expect(setState).toHaveBeenCalledWith('setup_in_progress')
      expect(result).toEqual({
        type: 'oauth_device_code',
        verification_url: 'https://microsoft.com/devicelogin',
        user_code: 'ABCD-EFGH',
        email: 'test@outlook.com'
      })
    })

    it('handles Outlook OAuth2 completion', async () => {
      const mockAccounts = [{ email: 'test@outlook.com', imap: {}, authType: 'oauth2' }]
      vi.mocked(parseCredentials).mockResolvedValue(mockAccounts as any)
      vi.mocked(isOutlookDomain).mockReturnValue(true)

      let completionCallback: any
      vi.mocked(initiateOutlookDeviceCode).mockImplementation((_email, callback) => {
        completionCallback = callback
        return Promise.resolve({
          verificationUri: 'uri',
          userCode: 'code'
        } as any)
      })

      await onCredentialsSaved({ EMAIL_CREDENTIALS: 'test@outlook.com:oauth2' })

      // Trigger completion
      await completionCallback()

      expect(setState).toHaveBeenCalledWith('configured')
    })

    it('returns error if initiateOutlookDeviceCode fails', async () => {
      const mockAccounts = [{ email: 'test@outlook.com', imap: {}, authType: 'oauth2' }]
      vi.mocked(parseCredentials).mockResolvedValue(mockAccounts as any)
      vi.mocked(isOutlookDomain).mockReturnValue(true)
      vi.mocked(initiateOutlookDeviceCode).mockRejectedValue(new Error('Network error'))

      const result = await onCredentialsSaved({ EMAIL_CREDENTIALS: 'test@outlook.com:oauth2' })

      expect(result).toEqual({
        type: 'error',
        text: 'Failed to start Outlook OAuth2 Device Code flow for test@outlook.com: Network error'
      })
    })

    it('forces fresh device-code flow even when parseCredentials returns cached oauth2 tokens', async () => {
      // Regression for 2026-04-24 UX bug: ``parseSingleCredential`` calls
      // ``loadStoredTokens`` and populates ``account.oauth2`` when a previous
      // session saved tokens. Without the force-refresh, ``initiateOutlookOAuth``
      // filters these accounts out via ``!a.oauth2`` and silently returns null,
      // so the form shows "Setup complete" without ever displaying the Microsoft
      // device-code step. ``onCredentialsSaved`` must clear cached tokens on
      // every form submit so the user always sees + completes the device-code UI.
      const mockAccounts = [
        {
          email: 'test@outlook.com',
          imap: {},
          authType: 'oauth2',
          // Simulate cached tokens from a previous session.
          oauth2: {
            accessToken: 'stale-access',
            refreshToken: 'stale-refresh',
            expiresAt: 0,
            clientId: 'stale-client'
          }
        }
      ]
      vi.mocked(parseCredentials).mockResolvedValue(mockAccounts as any)
      vi.mocked(isOutlookDomain).mockReturnValue(true)
      vi.mocked(initiateOutlookDeviceCode).mockResolvedValue({
        verificationUri: 'https://microsoft.com/devicelogin',
        userCode: 'ABCD-EFGH'
      } as any)

      const result = await onCredentialsSaved({ EMAIL_CREDENTIALS: 'test@outlook.com:oauth2' })

      expect(initiateOutlookDeviceCode).toHaveBeenCalledWith('test@outlook.com', expect.any(Function))
      expect(result).toEqual({
        type: 'oauth_device_code',
        verification_url: 'https://microsoft.com/devicelogin',
        user_code: 'ABCD-EFGH',
        email: 'test@outlook.com'
      })
    })

    it('logs error if writeConfig fails but continues', async () => {
      const mockAccounts = [{ email: 'test@gmail.com', imap: {}, authType: 'password' }]
      vi.mocked(parseCredentials).mockResolvedValue(mockAccounts as any)
      vi.mocked(isOutlookDomain).mockReturnValue(false)
      vi.mocked(writeConfig).mockRejectedValue(new Error('Disk full'))

      const mockConnect = vi.fn().mockResolvedValue(undefined)
      const mockLogout = vi.fn().mockResolvedValue(undefined)
      ;(ImapFlow as unknown as Mock).mockImplementation(function (this: any) {
        this.connect = mockConnect
        this.logout = mockLogout
        this.close = vi.fn()
      })

      const result = await onCredentialsSaved({ EMAIL_CREDENTIALS: 'test@gmail.com:pass' })

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to persist credentials: Disk full'))
      expect(result).toBeNull()
      expect(setState).toHaveBeenCalledWith('configured')
    })
  })

  describe('serverFactory', () => {
    it('registers tools with current accounts', async () => {
      const mockAccounts = [{ email: 'initial@test.com' }]
      vi.mocked(loadConfig).mockResolvedValue(mockAccounts as any)

      const startPromise = startHttp()
      await new Promise((resolve) => setTimeout(resolve, 50))

      const factory = vi.mocked(runHttpServer).mock.calls[0][0]

      const mockServer = {
        connect: vi.fn()
      }
      ;(Server as unknown as Mock).mockImplementation(function (this: any) {
        return mockServer
      })

      factory()

      expect(registerTools).toHaveBeenCalledWith(mockServer, mockAccounts)

      if (sigintHandler) await sigintHandler()
      await startPromise
    })
  })
})
