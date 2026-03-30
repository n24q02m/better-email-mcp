import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AccountConfig } from '../tools/helpers/config.js'
import { createEmailAuthProvider, requestContext } from './email-auth-provider.js'

const TEST_CONFIG = {
  dcrSecret: 'test-dcr-secret',
  publicUrl: 'https://test.example.com'
}

const makeAccount = (email: string): AccountConfig => ({
  id: email.replace(/[@.]/g, '_'),
  email,
  password: 'test-pass',
  authType: 'password',
  imap: { host: 'imap.gmail.com', port: 993, secure: true },
  smtp: { host: 'smtp.gmail.com', port: 465, secure: true }
})

describe('EmailAuthProvider', () => {
  let result: ReturnType<typeof createEmailAuthProvider>

  beforeEach(() => {
    result = createEmailAuthProvider(TEST_CONFIG)
  })

  afterEach(() => {
    clearInterval(result.cleanupInterval)
  })

  describe('provider structure', () => {
    it('should return provider and internal maps', () => {
      expect(result.provider).toBeDefined()
      expect(result.clientStore).toBeDefined()
      expect(result.pendingAuths).toBeInstanceOf(Map)
      expect(result.authCodes).toBeInstanceOf(Map)
      expect(result.bearerTokens).toBeInstanceOf(Map)
      expect(result.userAccounts).toBeInstanceOf(Map)
      expect(typeof result.resolveAccounts).toBe('function')
      expect(typeof result.resolveUserId).toBe('function')
    })
  })

  describe('resolveAccounts', () => {
    it('should return undefined for unknown token', () => {
      expect(result.resolveAccounts('unknown-token')).toBeUndefined()
    })

    it('should resolve accounts after direct token store', () => {
      const accounts = [makeAccount('test@gmail.com')]
      result.userAccounts.set('user-1', accounts)
      result.bearerTokens.set('test-bearer', { userId: 'user-1', createdAt: Date.now() })

      const resolved = result.resolveAccounts('test-bearer')
      expect(resolved).toEqual(accounts)
    })

    it('should resolve accounts after bound token', () => {
      const accounts = [makeAccount('test@gmail.com')]
      result.userAccounts.set('user-1', accounts)
      result.boundTokens.set('external-token', { userId: 'user-1', createdAt: Date.now() })

      const resolved = result.resolveAccounts('external-token')
      expect(resolved).toEqual(accounts)
    })
  })

  describe('resolveUserId', () => {
    it('should return undefined for unknown token', () => {
      expect(result.resolveUserId('unknown')).toBeUndefined()
    })

    it('should resolve from bearerTokens map', () => {
      result.bearerTokens.set('bearer-1', { userId: 'user-a', createdAt: Date.now() })
      expect(result.resolveUserId('bearer-1')).toBe('user-a')
    })

    it('should resolve from boundTokens map', () => {
      result.boundTokens.set('bound-1', { userId: 'user-b', createdAt: Date.now() })
      expect(result.resolveUserId('bound-1')).toBe('user-b')
    })
  })

  describe('verifyAccessToken', () => {
    it('should throw for unknown token', async () => {
      await expect(result.provider.verifyAccessToken('unknown')).rejects.toThrow('No email credentials found')
    })

    it('should verify valid token with accounts', async () => {
      result.userAccounts.set('user-1', [makeAccount('test@gmail.com')])
      result.bearerTokens.set('valid-token', { userId: 'user-1', createdAt: Date.now() })

      const authInfo = await result.provider.verifyAccessToken('valid-token')
      expect(authInfo.token).toBe('valid-token')
      expect(authInfo.clientId).toBe('email-mcp')
      expect(authInfo.scopes).toContain('email:read')
      expect(authInfo.scopes).toContain('email:write')
      expect(authInfo.extra?.userId).toBe('user-1')
    })

    it('should throw when user has no accounts', async () => {
      result.userAccounts.set('empty-user', [])
      result.bearerTokens.set('empty-token', { userId: 'empty-user', createdAt: Date.now() })

      await expect(result.provider.verifyAccessToken('empty-token')).rejects.toThrow(
        'No email accounts found for this user'
      )
    })

    it('should cache verification result', async () => {
      result.userAccounts.set('cached-user', [makeAccount('cached@gmail.com')])
      result.bearerTokens.set('cached-token', { userId: 'cached-user', createdAt: Date.now() })

      // First call
      await result.provider.verifyAccessToken('cached-token')
      // Second call should use cache (no accounts lookup needed)
      const authInfo = await result.provider.verifyAccessToken('cached-token')
      expect(authInfo.extra?.userId).toBe('cached-user')
    })
  })

  describe('exchangeRefreshToken', () => {
    it('should reject refresh token requests', async () => {
      const client = result.clientStore.registerClient({
        redirect_uris: ['http://localhost:3000/cb']
      } as any)

      await expect(result.provider.exchangeRefreshToken(client, 'any-refresh')).rejects.toThrow('Refresh not supported')
    })
  })

  describe('exchangeAuthorizationCode', () => {
    it('should reject invalid auth code', async () => {
      const client = result.clientStore.registerClient({
        redirect_uris: ['http://localhost:3000/cb']
      } as any)

      await expect(result.provider.exchangeAuthorizationCode(client, 'invalid-code')).rejects.toThrow(
        'Invalid or expired authorization code'
      )
    })

    it('should reject auth code from different client', async () => {
      const clientA = result.clientStore.registerClient({
        redirect_uris: ['http://localhost:3000/cb'],
        client_name: 'Client A'
      } as any)
      const clientB = result.clientStore.registerClient({
        redirect_uris: ['http://localhost:4000/cb'],
        client_name: 'Client B'
      } as any)

      result.authCodes.set('test-code', {
        userId: 'user-1',
        clientId: clientA.client_id,
        createdAt: Date.now()
      })

      await expect(result.provider.exchangeAuthorizationCode(clientB, 'test-code')).rejects.toThrow(
        'Auth code was not issued to this client'
      )
    })

    it('should exchange valid auth code for bearer token', async () => {
      const client = result.clientStore.registerClient({
        redirect_uris: ['http://localhost:3000/cb']
      } as any)

      result.userAccounts.set('user-1', [makeAccount('test@gmail.com')])
      result.authCodes.set('valid-code', {
        userId: 'user-1',
        clientId: client.client_id,
        createdAt: Date.now()
      })

      const tokens = await requestContext.run({ ip: '127.0.0.1' }, () =>
        result.provider.exchangeAuthorizationCode(client, 'valid-code')
      )

      expect(tokens.access_token).toBeTruthy()
      expect(tokens.token_type).toBe('bearer')
      expect(tokens.expires_in).toBe(86400)

      // Auth code should be consumed
      expect(result.authCodes.has('valid-code')).toBe(false)

      // Bearer token should map to user
      expect(result.bearerTokens.has(tokens.access_token)).toBe(true)
    })

    it('should reject PKCE mismatch', async () => {
      const client = result.clientStore.registerClient({
        redirect_uris: ['http://localhost:3000/cb']
      } as any)

      result.authCodes.set('pkce-code', {
        userId: 'user-1',
        codeChallenge: 'expected-challenge-hash',
        codeChallengeMethod: 'S256',
        clientId: client.client_id,
        createdAt: Date.now()
      })

      await expect(result.provider.exchangeAuthorizationCode(client, 'pkce-code', 'wrong-verifier')).rejects.toThrow(
        'code_verifier does not match'
      )
    })

    it('should require code_verifier when challenge is present', async () => {
      const client = result.clientStore.registerClient({
        redirect_uris: ['http://localhost:3000/cb']
      } as any)

      result.authCodes.set('pkce-code-2', {
        userId: 'user-1',
        codeChallenge: 'some-challenge',
        codeChallengeMethod: 'S256',
        clientId: client.client_id,
        createdAt: Date.now()
      })

      await expect(result.provider.exchangeAuthorizationCode(client, 'pkce-code-2')).rejects.toThrow(
        'code_verifier is required'
      )
    })
  })

  describe('authorize', () => {
    it('should redirect to relay page with state', async () => {
      const client = result.clientStore.registerClient({
        redirect_uris: ['http://localhost:3000/cb']
      } as any)

      let redirectUrl = ''
      const mockRes = {
        redirect: (url: string) => {
          redirectUrl = url
        }
      } as any

      await result.provider.authorize(
        client,
        {
          redirectUri: 'http://localhost:3000/cb',
          codeChallenge: 'test-challenge',
          state: 'client-state',
          scopes: ['email:read']
        } as any,
        mockRes
      )

      expect(redirectUrl).toContain('https://test.example.com/auth/relay')
      expect(redirectUrl).toContain('state=')

      // Should have stored a pending auth
      expect(result.pendingAuths.size).toBe(1)
      const pending = [...result.pendingAuths.values()][0]!
      expect(pending.clientId).toBe(client.client_id)
      expect(pending.clientRedirectUri).toBe('http://localhost:3000/cb')
      expect(pending.clientState).toBe('client-state')
    })
  })

  describe('pending bind (IP-scoped)', () => {
    it('should resolve direct bearer token regardless of IP', () => {
      result.userAccounts.set('bind-user', [makeAccount('bind@gmail.com')])
      result.bearerTokens.set('known-token', { userId: 'bind-user', createdAt: Date.now() })

      const resolved = requestContext.run({ ip: '10.0.0.1' }, () => result.resolveUserId('known-token'))
      expect(resolved).toBe('bind-user')
    })

    it('should resolve bound external token', () => {
      result.userAccounts.set('ext-user', [makeAccount('ext@gmail.com')])
      result.boundTokens.set('external-token', { userId: 'ext-user', createdAt: Date.now() })

      const resolved = result.resolveUserId('external-token')
      expect(resolved).toBe('ext-user')
    })
  })
})
