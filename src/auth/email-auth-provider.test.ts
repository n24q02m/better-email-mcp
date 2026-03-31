import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

    it('should resolve via pending bind with matching IP', () => {
      result.pendingAuths.set('pending-state', {
        clientId: 'client-1',
        clientRedirectUri: 'http://localhost/cb',
        codeChallenge: 'challenge',
        codeChallengeMethod: 'S256',
        createdAt: Date.now()
      })

      // Set up a pending bind that can be claimed
      // We need to use the internal structure -- pending binds are IP-scoped
      // Simulating via exchangeAuthorizationCode which creates pending binds

      // Direct approach: manually insert into internal state via the Maps
      // The pendingBinds map is not exposed, but we can test via exchangeAuthorizationCode
      const client = result.clientStore.registerClient({
        redirect_uris: ['http://localhost:3000/cb']
      } as any)

      result.userAccounts.set('bind-user', [makeAccount('bind@gmail.com')])
      result.authCodes.set('bind-code', {
        userId: 'bind-user',
        clientId: client.client_id,
        createdAt: Date.now()
      })

      // Exchange auth code (this creates a pending bind)
      const sourceIp = '192.168.1.100'

      return requestContext.run({ ip: sourceIp }, async () => {
        await result.provider.exchangeAuthorizationCode(client, 'bind-code')

        // Now try resolving an external token from the same IP
        // The pending bind should match
        const resolvedUserId = result.resolveUserId('sk-ant-external-token')
        expect(resolvedUserId).toBe('bind-user')

        // Verify the external token is now bound
        expect(result.boundTokens.has('sk-ant-external-token')).toBe(true)

        // Second resolution of the same external token should use bound tokens
        const resolvedAgain = result.resolveUserId('sk-ant-external-token')
        expect(resolvedAgain).toBe('bind-user')
      })
    })

    it('should skip expired pending binds', () => {
      const client = result.clientStore.registerClient({
        redirect_uris: ['http://localhost:3000/cb']
      } as any)

      result.userAccounts.set('expired-user', [makeAccount('expired@gmail.com')])
      result.authCodes.set('expired-code', {
        userId: 'expired-user',
        clientId: client.client_id,
        createdAt: Date.now()
      })

      return requestContext.run({ ip: '10.0.0.1' }, async () => {
        await result.provider.exchangeAuthorizationCode(client, 'expired-code')

        // Fast-forward time to expire the pending bind (30 seconds TTL)
        vi.useFakeTimers()
        vi.advanceTimersByTime(31_000)

        const resolved = result.resolveUserId('new-external-token')
        expect(resolved).toBeUndefined()

        vi.useRealTimers()
      })
    })

    it('should skip pending bind with mismatched IP', () => {
      const client = result.clientStore.registerClient({
        redirect_uris: ['http://localhost:3000/cb']
      } as any)

      result.userAccounts.set('ip-user', [makeAccount('ip@gmail.com')])
      result.authCodes.set('ip-code', {
        userId: 'ip-user',
        clientId: client.client_id,
        createdAt: Date.now()
      })

      return requestContext.run({ ip: '10.0.0.1' }, async () => {
        await result.provider.exchangeAuthorizationCode(client, 'ip-code')

        // Try to claim from different IP
        const resolved = requestContext.run({ ip: '10.0.0.2' }, () => result.resolveUserId('different-ip-token'))
        expect(resolved).toBeUndefined()
      })
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

    it('should return cached result with correct structure', async () => {
      result.userAccounts.set('cache-test', [makeAccount('cache@gmail.com')])
      result.bearerTokens.set('cache-token', { userId: 'cache-test', createdAt: Date.now() })

      // First call to populate cache
      await result.provider.verifyAccessToken('cache-token')

      // Second call uses cache -- verify the full response structure
      const authInfo = await result.provider.verifyAccessToken('cache-token')
      expect(authInfo.token).toBe('cache-token')
      expect(authInfo.clientId).toBe('email-mcp')
      expect(authInfo.scopes).toEqual(['email:read', 'email:write'])
      expect(authInfo.expiresAt).toBeGreaterThan(0)
      expect(authInfo.extra?.userId).toBe('cache-test')
    })

    it('should throw when user has no accounts in userAccounts map', async () => {
      // User exists in bearerTokens but has NO entry in userAccounts at all
      result.bearerTokens.set('orphan-token', { userId: 'orphan-user', createdAt: Date.now() })

      await expect(result.provider.verifyAccessToken('orphan-token')).rejects.toThrow(
        'No email accounts found for this user'
      )
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

  describe('challengeForAuthorizationCode', () => {
    it('should return code challenge for valid auth code', async () => {
      const client = result.clientStore.registerClient({
        redirect_uris: ['http://localhost:3000/cb']
      } as any)

      result.authCodes.set('challenge-code', {
        userId: 'user-1',
        codeChallenge: 'test-challenge-value',
        codeChallengeMethod: 'S256',
        clientId: client.client_id,
        createdAt: Date.now()
      })

      const challenge = await result.provider.challengeForAuthorizationCode(client, 'challenge-code')
      expect(challenge).toBe('test-challenge-value')
    })

    it('should return empty string when no challenge stored', async () => {
      const client = result.clientStore.registerClient({
        redirect_uris: ['http://localhost:3000/cb']
      } as any)

      result.authCodes.set('no-challenge-code', {
        userId: 'user-1',
        clientId: client.client_id,
        createdAt: Date.now()
      })

      const challenge = await result.provider.challengeForAuthorizationCode(client, 'no-challenge-code')
      expect(challenge).toBe('')
    })

    it('should throw for invalid auth code', async () => {
      const client = result.clientStore.registerClient({
        redirect_uris: ['http://localhost:3000/cb']
      } as any)

      await expect(result.provider.challengeForAuthorizationCode(client, 'nonexistent-code')).rejects.toThrow(
        'Invalid or expired authorization code'
      )
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

    it('should accept valid PKCE S256 challenge', async () => {
      const client = result.clientStore.registerClient({
        redirect_uris: ['http://localhost:3000/cb']
      } as any)

      // Generate valid PKCE pair
      const codeVerifier = 'test-code-verifier-1234567890-abcdefghijklmnop'
      const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')

      result.authCodes.set('valid-pkce-code', {
        userId: 'pkce-user',
        codeChallenge,
        codeChallengeMethod: 'S256',
        clientId: client.client_id,
        createdAt: Date.now()
      })

      result.userAccounts.set('pkce-user', [makeAccount('pkce@gmail.com')])

      const tokens = await requestContext.run({ ip: '127.0.0.1' }, () =>
        result.provider.exchangeAuthorizationCode(client, 'valid-pkce-code', codeVerifier)
      )

      expect(tokens.access_token).toBeTruthy()
      expect(tokens.token_type).toBe('bearer')
    })

    it('should exchange auth code without clientId binding', async () => {
      const client = result.clientStore.registerClient({
        redirect_uris: ['http://localhost:3000/cb']
      } as any)

      result.userAccounts.set('user-no-bind', [makeAccount('nobind@gmail.com')])
      result.authCodes.set('no-bind-code', {
        userId: 'user-no-bind',
        createdAt: Date.now()
        // No clientId binding
      })

      const tokens = await requestContext.run({ ip: '127.0.0.1' }, () =>
        result.provider.exchangeAuthorizationCode(client, 'no-bind-code')
      )

      expect(tokens.access_token).toBeTruthy()
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

  describe('cleanup interval', () => {
    it('should clean up expired pendingAuths', async () => {
      vi.useFakeTimers()

      // Re-create provider with fake timers active
      clearInterval(result.cleanupInterval)
      result = createEmailAuthProvider(TEST_CONFIG)

      // Add an expired pending auth (TTL is 10 minutes = 600000ms)
      result.pendingAuths.set('expired-pending', {
        clientId: 'client-1',
        clientRedirectUri: 'http://localhost/cb',
        codeChallenge: 'challenge',
        codeChallengeMethod: 'S256',
        createdAt: Date.now() - 700_000 // 11+ minutes ago
      })

      // Add a fresh pending auth
      result.pendingAuths.set('fresh-pending', {
        clientId: 'client-2',
        clientRedirectUri: 'http://localhost/cb',
        codeChallenge: 'challenge',
        codeChallengeMethod: 'S256',
        createdAt: Date.now()
      })

      expect(result.pendingAuths.size).toBe(2)

      // Trigger cleanup (runs every 60 seconds)
      vi.advanceTimersByTime(61_000)

      expect(result.pendingAuths.has('expired-pending')).toBe(false)
      expect(result.pendingAuths.has('fresh-pending')).toBe(true)

      clearInterval(result.cleanupInterval)
      vi.useRealTimers()
    })

    it('should clean up expired authCodes', async () => {
      vi.useFakeTimers()
      clearInterval(result.cleanupInterval)
      result = createEmailAuthProvider(TEST_CONFIG)

      // Add expired auth code (TTL is 10 minutes)
      result.authCodes.set('expired-code', {
        userId: 'user-1',
        createdAt: Date.now() - 700_000
      })

      result.authCodes.set('fresh-code', {
        userId: 'user-2',
        createdAt: Date.now()
      })

      vi.advanceTimersByTime(61_000)

      expect(result.authCodes.has('expired-code')).toBe(false)
      expect(result.authCodes.has('fresh-code')).toBe(true)

      clearInterval(result.cleanupInterval)
      vi.useRealTimers()
    })

    it('should clean up expired bearerTokens', async () => {
      vi.useFakeTimers()
      clearInterval(result.cleanupInterval)
      result = createEmailAuthProvider(TEST_CONFIG)

      // Add expired bearer token (TTL is 24 hours = 86400000ms)
      result.bearerTokens.set('expired-bearer', {
        userId: 'user-1',
        createdAt: Date.now() - 87_000_000
      })

      result.bearerTokens.set('fresh-bearer', {
        userId: 'user-2',
        createdAt: Date.now()
      })

      vi.advanceTimersByTime(61_000)

      expect(result.bearerTokens.has('expired-bearer')).toBe(false)
      expect(result.bearerTokens.has('fresh-bearer')).toBe(true)

      clearInterval(result.cleanupInterval)
      vi.useRealTimers()
    })

    it('should clean up expired boundTokens', async () => {
      vi.useFakeTimers()
      clearInterval(result.cleanupInterval)
      result = createEmailAuthProvider(TEST_CONFIG)

      // Add expired bound token (TTL is 24 hours)
      result.boundTokens.set('expired-bound', {
        userId: 'user-1',
        createdAt: Date.now() - 87_000_000
      })

      result.boundTokens.set('fresh-bound', {
        userId: 'user-2',
        createdAt: Date.now()
      })

      vi.advanceTimersByTime(61_000)

      expect(result.boundTokens.has('expired-bound')).toBe(false)
      expect(result.boundTokens.has('fresh-bound')).toBe(true)

      clearInterval(result.cleanupInterval)
      vi.useRealTimers()
    })
  })
})
