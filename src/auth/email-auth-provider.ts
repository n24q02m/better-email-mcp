/**
 * Email OAuth Server Provider
 *
 * Implements OAuthServerProvider for multi-user HTTP mode.
 * Instead of delegating to an external OAuth provider (like Notion),
 * users submit email credentials via a relay page. The server validates
 * credentials by attempting an IMAP connection, then issues bearer tokens.
 *
 * Flow:
 * 1. MCP client registers via DCR (stateless HMAC)
 * 2. MCP client calls /authorize -> redirect to relay credential entry page
 * 3. User submits email credentials via relay
 * 4. Server validates credentials via IMAP test connection
 * 5. Server issues auth code, redirects to MCP client
 * 6. MCP client exchanges auth code for bearer token
 * 7. Bearer token resolves to per-user AccountConfig[]
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { RelaySession } from '@n24q02m/mcp-relay-core/relay'
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js'
import { InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js'
import type { AuthorizationParams, OAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/provider.js'
import type { OAuthClientInformationFull, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js'
import type { Response } from 'express'
import type { AccountConfig } from '../tools/helpers/config.js'
import { StatelessClientStore } from './stateless-client-store.js'

/** Request context propagated via AsyncLocalStorage for IP-scoped pending binds */
export const requestContext = new AsyncLocalStorage<{ ip?: string }>()

const AUTH_CODE_TTL = 10 * 60 * 1000 // 10 minutes
const PENDING_AUTH_TTL = 10 * 60 * 1000 // 10 minutes
const BEARER_TOKEN_TTL = 24 * 60 * 60 * 1000 // 24 hours
const PENDING_BIND_TTL = 30 * 1000 // 30 seconds to claim a pending bind
const VERIFY_CACHE_TTL = 5 * 60 * 1000 // 5 minutes cache for token verification

export interface EmailAuthConfig {
  dcrSecret: string
  publicUrl: string
  /** Create a relay session and return the browser URL. If not provided, falls back to built-in /auth/relay form. */
  createRelaySession?: () => Promise<{ relayUrl: string; session: RelaySession }>
}

export interface PendingAuth {
  clientId: string
  clientRedirectUri: string
  clientState?: string
  codeChallenge: string
  codeChallengeMethod: string
  scopes?: string[]
  createdAt: number
  relaySession?: RelaySession
}

interface StoredAuthCode {
  userId: string
  codeChallenge?: string
  codeChallengeMethod?: string
  clientId?: string
  createdAt: number
}

interface StoredToken {
  userId: string
  createdAt: number
}

/**
 * Create the Email auth provider for multi-user HTTP mode.
 *
 * Returns the provider + internal maps needed by the HTTP transport
 * to handle credential submission and token resolution.
 */
export function createEmailAuthProvider(config: EmailAuthConfig) {
  const clientStore = new StatelessClientStore(config.dcrSecret)

  // Temporary stores for the auth relay flow
  const pendingAuths = new Map<string, PendingAuth>()
  const authCodes = new Map<string, StoredAuthCode>()

  // Bearer token -> userId mapping
  const bearerTokens = new Map<string, StoredToken>()
  // Bound external tokens (e.g., Claude Code's sk-ant-*) -> userId
  const boundTokens = new Map<string, StoredToken>()
  // Per-user account configs (userId -> AccountConfig[])
  const userAccounts = new Map<string, AccountConfig[]>()
  // Verification cache
  const verifyCache = new Map<string, { expiresAt: number; userId: string }>()
  // Pending bind slots (one-shot, IP-scoped)
  const pendingBinds = new Map<string, { token: StoredToken; expiresAt: number; sourceIp?: string }>()

  /** Resolve a bearer token to a userId */
  function resolveUserId(bearerToken: string): string | undefined {
    // 1. Direct lookup by our opaque access token
    const byToken = bearerTokens.get(bearerToken)
    if (byToken) return byToken.userId

    // 2. Previously bound external token
    const bound = boundTokens.get(bearerToken)
    if (bound) return bound.userId

    // 3. One-shot pending bind (IP-scoped)
    const now = Date.now()
    const claimIp = requestContext.getStore()?.ip
    for (const [clientId, pending] of pendingBinds) {
      if (now > pending.expiresAt) {
        pendingBinds.delete(clientId)
        continue
      }
      if (!pending.sourceIp || !claimIp || pending.sourceIp !== claimIp) {
        continue
      }
      pendingBinds.delete(clientId)
      boundTokens.set(bearerToken, pending.token)
      return pending.token.userId
    }
    return undefined
  }

  /** Resolve a bearer token to per-user AccountConfig[] */
  function resolveAccounts(bearerToken: string): AccountConfig[] | undefined {
    const userId = resolveUserId(bearerToken)
    if (!userId) return undefined
    return userAccounts.get(userId)
  }

  const provider: OAuthServerProvider = {
    get clientsStore(): OAuthRegisteredClientsStore {
      return clientStore
    },

    authorize: async (
      client: OAuthClientInformationFull,
      params: AuthorizationParams,
      res: Response
    ): Promise<void> => {
      const ourState = randomBytes(32).toString('hex')

      const pending: PendingAuth = {
        clientId: client.client_id,
        clientRedirectUri: params.redirectUri,
        clientState: params.state,
        codeChallenge: params.codeChallenge,
        codeChallengeMethod: 'S256',
        scopes: params.scopes,
        createdAt: Date.now()
      }

      // Use mcp-relay-core relay page — no fallback to built-in form
      if (!config.createRelaySession) {
        res.status(500).json({ error: 'server_error', error_description: 'Relay session creator not configured' })
        return
      }

      const { relayUrl, session } = await config.createRelaySession()
      pending.relaySession = session
      pendingAuths.set(ourState, pending)
      res.redirect(relayUrl)
    },

    challengeForAuthorizationCode: async (
      _client: OAuthClientInformationFull,
      authorizationCode: string
    ): Promise<string> => {
      const stored = authCodes.get(authorizationCode)
      if (!stored) {
        throw new InvalidTokenError('Invalid or expired authorization code')
      }
      return stored.codeChallenge ?? ''
    },

    exchangeAuthorizationCode: async (
      client: OAuthClientInformationFull,
      authorizationCode: string,
      codeVerifier?: string
    ): Promise<OAuthTokens> => {
      const stored = authCodes.get(authorizationCode)
      if (!stored) {
        throw new InvalidTokenError('Invalid or expired authorization code')
      }

      // Verify client binding
      if (stored.clientId && stored.clientId !== client.client_id) {
        throw new InvalidTokenError('Auth code was not issued to this client')
      }

      // Verify PKCE S256 (only when SDK passes codeVerifier — SDK validates locally by default)
      if (codeVerifier && stored.codeChallenge && stored.codeChallengeMethod === 'S256') {
        const expectedChallenge = createHash('sha256').update(codeVerifier).digest('base64url')

        const expectedBuffer = Buffer.from(expectedChallenge, 'utf8')
        const storedBuffer = Buffer.from(stored.codeChallenge, 'utf8')

        if (expectedBuffer.byteLength !== storedBuffer.byteLength || !timingSafeEqual(expectedBuffer, storedBuffer)) {
          throw new InvalidTokenError('code_verifier does not match the challenge')
        }
      }

      authCodes.delete(authorizationCode)

      // Issue opaque access token
      const opaqueToken = randomBytes(48).toString('hex')
      const entry: StoredToken = {
        userId: stored.userId,
        createdAt: Date.now()
      }

      bearerTokens.set(opaqueToken, entry)

      // Create one-shot pending bind for clients using their own identity tokens
      pendingBinds.set(client.client_id, {
        token: entry,
        expiresAt: Date.now() + PENDING_BIND_TTL,
        sourceIp: requestContext.getStore()?.ip
      })

      return {
        access_token: opaqueToken,
        token_type: 'bearer',
        expires_in: 86400
      }
    },

    exchangeRefreshToken: async (_client: OAuthClientInformationFull, _refreshToken: string): Promise<OAuthTokens> => {
      // Email credentials don't expire like OAuth tokens.
      // Refresh is not applicable -- clients should re-authenticate.
      throw new InvalidTokenError('Refresh not supported. Please re-authenticate.')
    },

    verifyAccessToken: async (token: string) => {
      const userId = resolveUserId(token)
      if (!userId) {
        throw new InvalidTokenError('No email credentials found. Please authenticate.')
      }

      // Check verification cache
      const cached = verifyCache.get(userId)
      if (cached && Date.now() < cached.expiresAt) {
        return {
          token,
          clientId: 'email-mcp',
          scopes: ['email:read', 'email:write'],
          expiresAt: Math.floor(Date.now() / 1000) + 3600,
          extra: { userId }
        }
      }

      // Verify user has accounts configured
      const accounts = userAccounts.get(userId)
      if (!accounts || accounts.length === 0) {
        throw new InvalidTokenError('No email accounts found for this user')
      }

      // Cache the verification result
      verifyCache.set(userId, {
        expiresAt: Date.now() + VERIFY_CACHE_TTL,
        userId
      })

      return {
        token,
        clientId: 'email-mcp',
        scopes: ['email:read', 'email:write'],
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        extra: { userId }
      }
    }
  }

  // Cleanup expired entries periodically
  const cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [key, val] of pendingAuths) {
      if (now - val.createdAt > PENDING_AUTH_TTL) pendingAuths.delete(key)
    }
    for (const [key, val] of authCodes) {
      if (now - val.createdAt > AUTH_CODE_TTL) authCodes.delete(key)
    }
    for (const [key, val] of bearerTokens) {
      if (now - val.createdAt > BEARER_TOKEN_TTL) bearerTokens.delete(key)
    }
    for (const [key, val] of pendingBinds) {
      if (now > val.expiresAt) pendingBinds.delete(key)
    }
    for (const [key, val] of boundTokens) {
      if (now - val.createdAt > BEARER_TOKEN_TTL) boundTokens.delete(key)
    }
    for (const [key, val] of verifyCache) {
      if (now > val.expiresAt) verifyCache.delete(key)
    }
  }, 60_000)

  return {
    provider,
    clientStore,
    pendingAuths,
    authCodes,
    bearerTokens,
    boundTokens,
    userAccounts,
    resolveAccounts,
    resolveUserId,
    cleanupInterval
  }
}
