import { runHttpServer, writeConfig } from '@n24q02m/mcp-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getMarkSetupComplete, setState } from '../credential-state.js'
import { loadConfig, parseCredentials } from '../tools/helpers/config.js'
import { initiateOutlookDeviceCode, isOutlookDomain } from '../tools/helpers/oauth2.js'

// Mock dependencies
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn()
}))

vi.mock('@n24q02m/mcp-core', () => ({
  runHttpServer: vi.fn(),
  writeConfig: vi.fn()
}))

vi.mock('imapflow', () => ({
  ImapFlow: class {
    connect = vi.fn().mockResolvedValue(undefined)
    logout = vi.fn().mockResolvedValue(undefined)
    on = vi.fn()
  }
}))

vi.mock('../credential-state.js', () => ({
  resolveCredentialState: vi.fn(),
  setMarkSetupComplete: vi.fn(),
  setSetupUrl: vi.fn(),
  setState: vi.fn(),
  getMarkSetupComplete: vi.fn()
}))

vi.mock('../tools/helpers/config.js', () => ({
  loadConfig: vi.fn(),
  parseCredentials: vi.fn()
}))

vi.mock('../tools/helpers/oauth2.js', () => ({
  initiateOutlookDeviceCode: vi.fn(),
  isOutlookDomain: vi.fn(),
  setOutlookTokenStore: vi.fn()
}))

vi.mock('../tools/registry.js', () => ({
  registerTools: vi.fn()
}))

// Mock console.error to avoid noise
vi.spyOn(console, 'error').mockImplementation(() => {})

import { startHttp } from './http.js'

describe('HTTP Transport', () => {
  let onCredentialsSaved: any
  let setupCompleteHook: any

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadConfig).mockResolvedValue([])
    vi.mocked(runHttpServer).mockImplementation((_factory: any, options: any) => {
      onCredentialsSaved = options.onCredentialsSaved
      setupCompleteHook = options.setupCompleteHook
      return Promise.resolve({ host: 'localhost', port: 3000, close: vi.fn() })
    })
  })

  describe('startHttp', () => {
    it('starts the HTTP server and registers setupCompleteHook', async () => {
      const promise = startHttp()

      await new Promise((r) => setTimeout(r, 10))

      expect(runHttpServer).toHaveBeenCalled()
      expect(setupCompleteHook).toBeDefined()

      const markComplete = vi.fn()
      setupCompleteHook(markComplete)
      const { setMarkSetupComplete } = await import('../credential-state.js')
      expect(setMarkSetupComplete).toHaveBeenCalledWith(markComplete)

      process.emit('SIGINT' as any)
      await promise
    })
  })

  describe('onCredentialsSaved', () => {
    let httpPromise: Promise<void>

    beforeEach(async () => {
      httpPromise = startHttp()
      await new Promise((r) => setTimeout(r, 10))
    })

    afterEach(async () => {
      process.emit('SIGINT' as any)
      await httpPromise
    })

    it('returns error if parseCredentials fails', async () => {
      vi.mocked(parseCredentials).mockRejectedValue(new Error('parsing failed'))

      const result = await onCredentialsSaved({ EMAIL_CREDENTIALS: 'invalid' })

      expect(result).toEqual({
        type: 'error',
        text: 'Failed to parse credentials: parsing failed'
      })
    })

    it('returns error if no accounts found', async () => {
      vi.mocked(parseCredentials).mockResolvedValue([])

      const result = await onCredentialsSaved({ EMAIL_CREDENTIALS: ' ' })

      expect(result).toEqual({
        type: 'error',
        text: 'Email credentials are required. Format: email:app-password'
      })
    })

    it('handles standard IMAP accounts and finishes if no Outlook', async () => {
      const mockAccounts = [{ email: 'test@gmail.com', imap: {} }]
      vi.mocked(parseCredentials).mockResolvedValue(mockAccounts as any)
      vi.mocked(isOutlookDomain).mockReturnValue(false)

      const result = await onCredentialsSaved({ EMAIL_CREDENTIALS: 'test@gmail.com:pass' })

      expect(result).toBeNull()
      expect(setState).toHaveBeenCalledWith('configured')
      expect(writeConfig).toHaveBeenCalledWith(expect.any(String), { EMAIL_CREDENTIALS: 'test@gmail.com:pass' })
    })

    it('initiates Outlook OAuth2 if Outlook account present', async () => {
      const mockAccounts = [{ email: 'test@outlook.com', imap: {}, authType: 'oauth2' }]
      vi.mocked(parseCredentials).mockResolvedValue(mockAccounts as any)
      vi.mocked(isOutlookDomain).mockReturnValue(true)
      vi.mocked(initiateOutlookDeviceCode).mockResolvedValue({
        verificationUri: 'https://microsoft.com/devicelogin',
        userCode: 'ABCD-EFGH',
        expiresIn: 900,
        interval: 5
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
      const mockAccounts = [{ email: 'test@outlook.com', imap: {}, authType: 'oauth2' }]
      vi.mocked(parseCredentials).mockResolvedValue(mockAccounts as any)
      vi.mocked(isOutlookDomain).mockReturnValue(true)

      let completionCallback: any
      const markComplete = vi.fn()
      vi.mocked(initiateOutlookDeviceCode).mockImplementation(async (_email, callback) => {
        completionCallback = callback
        return {
          verificationUri: 'uri',
          userCode: 'code'
        } as any
      })
      vi.mocked(getMarkSetupComplete).mockReturnValue(markComplete)

      await onCredentialsSaved({ EMAIL_CREDENTIALS: 'test@outlook.com:oauth2' })

      await completionCallback()

      expect(setState).toHaveBeenCalledWith('configured')
      expect(markComplete).toHaveBeenCalledWith('outlook')
    })

    it('does not throw when setMarkSetupComplete hook is null on Outlook completion', async () => {
      const mockAccounts = [{ email: 'test@outlook.com', imap: {}, authType: 'oauth2' }]
      vi.mocked(parseCredentials).mockResolvedValue(mockAccounts as any)
      vi.mocked(isOutlookDomain).mockReturnValue(true)

      let completionCallback: any
      vi.mocked(initiateOutlookDeviceCode).mockImplementation(async (_email, callback) => {
        completionCallback = callback
        return {
          verificationUri: 'uri',
          userCode: 'code'
        } as any
      })
      vi.mocked(getMarkSetupComplete).mockReturnValue(null)

      await onCredentialsSaved({ EMAIL_CREDENTIALS: 'test@outlook.com:oauth2' })

      await completionCallback()
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
  })
})
