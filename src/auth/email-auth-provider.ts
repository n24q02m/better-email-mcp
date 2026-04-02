/**
 * MCP Server OAuth Provider for Email Credentials (Relay Mode).
 *
 * This provider implements the MCP OAuth server interface but validates
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
}

interface PendingAuth {
  clientId: string
  clientRedirectUri: string
  clientState?: string
  codeChallenge: string
  codeChallengeMethod: string
  scopes?: string[]
  createdAt: number
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

interface AuthProviderState {
  pendingAuths: Map<string, PendingAuth>
  authCodes: Map<string, StoredAuthCode>
  bearerTokens: Map<string, StoredToken>
  boundTokens: Map<string, StoredToken>
  userAccounts: Map<string, AccountConfig[]>
  verifyCache: Map<string, { expiresAt: number; userId: string }>
  pendingBinds: Map<string, { token: StoredToken; expiresAt: number; sourceIp?: string }>
}

function cleanupExpired<K, V>(map: Map<K, V>, isExpired: (val: V) => boolean) {
  for (const [key, val] of map) {
    if (isExpired(val)) {
      map.delete(key)
    }
  }
}

/** Resolve a bearer token to a userId */
function resolveUserId(state: AuthProviderState, bearerToken: string): string | undefined {
  // 1. Direct lookup by our opaque access token
  const byToken = state.bearerTokens.get(bearerToken)
  if (byToken) return byToken.userId

  // 2. Previously bound external token
  const bound = state.boundTokens.get(bearerToken)
  if (bound) return bound.userId

  // 3. One-shot pending bind (IP-scoped)
  const now = Date.now()
  const claimIp = requestContext.getStore()?.ip
  for (const [clientId, pending] of state.pendingBinds) {
    if (now > pending.expiresAt) {
      state.pendingBinds.delete(clientId)
      continue
    }
    if (!pending.sourceIp || !claimIp || pending.sourceIp !== claimIp) {
      continue
    }
    state.pendingBinds.delete(clientId)
    state.boundTokens.set(bearerToken, pending.token)
    return pending.token.userId
  }
  return undefined
}

/** Resolve a bearer token to per-user AccountConfig[] */
function resolveAccounts(state: AuthProviderState, bearerToken: string): AccountConfig[] | undefined {
  const userId = resolveUserId(state, bearerToken)
  if (!userId) return undefined
  return state.userAccounts.get(userId)
}

/**
 * OAuth server provider implementation for email credentials.
 */
class EmailOAuthProvider implements OAuthServerProvider {
  constructor(
    private config: EmailAuthConfig,
    private state: AuthProviderState,
    private clientStore: StatelessClientStore
  ) {}

  get clientsStore(): OAuthRegisteredClientsStore {
    return this.clientStore
  }

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    const ourState = randomBytes(32).toString('hex')

    this.state.pendingAuths.set(ourState, {
      clientId: client.client_id,
      clientRedirectUri: params.redirectUri,
      clientState: params.state,
      codeChallenge: params.codeChallenge,
      codeChallengeMethod: 'S256',
      scopes: params.scopes,
      createdAt: Date.now()
    })

    // Redirect to relay credential entry page with our state
    const relayUrl = new URL(`${this.config.publicUrl}/auth/relay`)
    relayUrl.searchParams.set('state', ourState)
    res.redirect(relayUrl.toString())
  }

  async challengeForAuthorizationCode(_client: OAuthClientInformationFull, authorizationCode: string): Promise<string> {
    const stored = this.state.authCodes.get(authorizationCode)
    if (!stored) {
      throw new InvalidTokenError('Invalid or expired authorization code')
    }
    return stored.codeChallenge ?? ''
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    codeVerifier?: string
  ): Promise<OAuthTokens> {
    const stored = this.state.authCodes.get(authorizationCode)
    if (!stored) {
      throw new InvalidTokenError('Invalid or expired authorization code')
    }

    // Verify client binding
    if (stored.clientId && stored.clientId !== client.client_id) {
      throw new InvalidTokenError('Auth code was not issued to this client')
    }

    // Verify PKCE S256
    if (stored.codeChallenge && stored.codeChallengeMethod === 'S256') {
      if (!codeVerifier) {
        throw new InvalidTokenError('code_verifier is required')
      }
      const expectedChallenge = createHash('sha256').update(codeVerifier).digest('base64url')

      const expectedBuffer = Buffer.from(expectedChallenge, 'utf8')
      const storedBuffer = Buffer.from(stored.codeChallenge, 'utf8')

      if (expectedBuffer.byteLength !== storedBuffer.byteLength || !timingSafeEqual(expectedBuffer, storedBuffer)) {
        throw new InvalidTokenError('code_verifier does not match the challenge')
      }
    }

    this.state.authCodes.delete(authorizationCode)

    // Issue opaque access token
    const opaqueToken = randomBytes(48).toString('hex')
    const entry: StoredToken = {
      userId: stored.userId,
      createdAt: Date.now()
    }

    this.state.bearerTokens.set(opaqueToken, entry)

    // Create one-shot pending bind for clients using their own identity tokens
    this.state.pendingBinds.set(client.client_id, {
      token: entry,
      expiresAt: Date.now() + PENDING_BIND_TTL,
      sourceIp: requestContext.getStore()?.ip
    })

    return {
      access_token: opaqueToken,
      token_type: 'bearer',
      expires_in: 86400
    }
  }

  async exchangeRefreshToken(_client: OAuthClientInformationFull, _refreshToken: string): Promise<OAuthTokens> {
    // Email credentials don't expire like OAuth tokens.
    // Refresh is not applicable -- clients should re-authenticate.
    throw new InvalidTokenError('Refresh not supported. Please re-authenticate.')
  }

  async verifyAccessToken(token: string) {
    const userId = resolveUserId(this.state, token)
    if (!userId) {
      throw new InvalidTokenError('No email credentials found. Please authenticate.')
    }

    // Check verification cache
    const cached = this.state.verifyCache.get(userId)
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
    const accounts = this.state.userAccounts.get(userId)
    if (!accounts || accounts.length === 0) {
      throw new InvalidTokenError('No email accounts found for this user')
    }

    // Cache the verification result
    this.state.verifyCache.set(userId, {
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

/**
 * Create the Email auth provider for multi-user HTTP mode.
 *
 * Returns the provider + internal maps needed by the HTTP transport
 * to handle credential submission and token resolution.
 */
export function createEmailAuthProvider(config: EmailAuthConfig) {
  const clientStore = new StatelessClientStore(config.dcrSecret)

  const state: AuthProviderState = {
    pendingAuths: new Map(),
    authCodes: new Map(),
    bearerTokens: new Map(),
    boundTokens: new Map(),
    userAccounts: new Map(),
    verifyCache: new Map(),
    pendingBinds: new Map()
  }

  const provider = new EmailOAuthProvider(config, state, clientStore)

  // Cleanup expired entries periodically
  const cleanupInterval = setInterval(() => {
    const now = Date.now()
    cleanupExpired(state.pendingAuths, (val) => now - val.createdAt > PENDING_AUTH_TTL)
    cleanupExpired(state.authCodes, (val) => now - val.createdAt > AUTH_CODE_TTL)
    cleanupExpired(state.bearerTokens, (val) => now - val.createdAt > BEARER_TOKEN_TTL)
    cleanupExpired(state.pendingBinds, (val) => now > val.expiresAt)
    cleanupExpired(state.boundTokens, (val) => now - val.createdAt > BEARER_TOKEN_TTL)
    cleanupExpired(state.verifyCache, (val) => now > val.expiresAt)
  }, 60_000)

  return {
    provider,
    clientStore,
    pendingAuths: state.pendingAuths,
    authCodes: state.authCodes,
    bearerTokens: state.bearerTokens,
    boundTokens: state.boundTokens,
    userAccounts: state.userAccounts,
    resolveAccounts: (token: string) => resolveAccounts(state, token),
    resolveUserId: (token: string) => resolveUserId(state, token),
    cleanupInterval
  }
}
