import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js'
import { InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js'
import type { AuthorizationParams, OAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/provider.js'
import type { OAuthClientInformationFull, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js'
import type { RelaySession } from '@n24q02m/mcp-relay-core/relay'
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

export interface StoredAuthCode {
  userId: string
  codeChallenge?: string
  codeChallengeMethod?: string
  clientId?: string
  createdAt: number
}

export interface StoredToken {
  userId: string
  createdAt: number
}

export class EmailAuthProviderImpl implements OAuthServerProvider {
  public readonly clientStore: StatelessClientStore
  public readonly pendingAuths = new Map<string, PendingAuth>()
  public readonly authCodes = new Map<string, StoredAuthCode>()
  public readonly bearerTokens = new Map<string, StoredToken>()
  public readonly boundTokens = new Map<string, StoredToken>()
  public readonly userAccounts = new Map<string, AccountConfig[]>()
  private readonly verifyCache = new Map<string, { expiresAt: number; userId: string }>()
  private readonly pendingBinds = new Map<string, { token: StoredToken; expiresAt: number; sourceIp?: string }>()
  public readonly cleanupInterval: NodeJS.Timeout

  constructor(private readonly config: EmailAuthConfig) {
    this.clientStore = new StatelessClientStore(config.dcrSecret)
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000)
  }

  get clientsStore(): OAuthRegisteredClientsStore {
    return this.clientStore
  }

  public resolveUserId(bearerToken: string): string | undefined {
    const byToken = this.bearerTokens.get(bearerToken)
    if (byToken) return byToken.userId

    const bound = this.boundTokens.get(bearerToken)
    if (bound) return bound.userId

    const now = Date.now()
    const claimIp = requestContext.getStore()?.ip
    for (const [clientId, pending] of this.pendingBinds) {
      if (now > pending.expiresAt) {
        this.pendingBinds.delete(clientId)
        continue
      }
      if (!pending.sourceIp || !claimIp || pending.sourceIp !== claimIp) {
        continue
      }
      this.pendingBinds.delete(clientId)
      this.boundTokens.set(bearerToken, pending.token)
      return pending.token.userId
    }
    return undefined
  }

  public resolveAccounts(bearerToken: string): AccountConfig[] | undefined {
    const userId = this.resolveUserId(bearerToken)
    if (!userId) return undefined
    return this.userAccounts.get(userId)
  }

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
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

    if (!this.config.createRelaySession) {
      res.status(500).json({ error: 'server_error', error_description: 'Relay session creator not configured' })
      return
    }

    const { relayUrl, session } = await this.config.createRelaySession()
    pending.relaySession = session
    this.pendingAuths.set(ourState, pending)
    res.redirect(relayUrl)
  }

  async challengeForAuthorizationCode(_client: OAuthClientInformationFull, authorizationCode: string): Promise<string> {
    const stored = this.authCodes.get(authorizationCode)
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
    const stored = this.authCodes.get(authorizationCode)
    if (!stored) {
      throw new InvalidTokenError('Invalid or expired authorization code')
    }

    if (stored.clientId && stored.clientId !== client.client_id) {
      throw new InvalidTokenError('Auth code was not issued to this client')
    }

    if (codeVerifier && stored.codeChallenge && stored.codeChallengeMethod === 'S256') {
      const expectedChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
      const expectedBuffer = Buffer.from(expectedChallenge, 'utf8')
      const storedBuffer = Buffer.from(stored.codeChallenge, 'utf8')

      if (expectedBuffer.byteLength !== storedBuffer.byteLength || !timingSafeEqual(expectedBuffer, storedBuffer)) {
        throw new InvalidTokenError('code_verifier does not match the challenge')
      }
    }

    this.authCodes.delete(authorizationCode)

    const opaqueToken = randomBytes(48).toString('hex')
    const entry: StoredToken = {
      userId: stored.userId,
      createdAt: Date.now()
    }

    this.bearerTokens.set(opaqueToken, entry)

    this.pendingBinds.set(client.client_id, {
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
    throw new InvalidTokenError('Refresh not supported. Please re-authenticate.')
  }

  async verifyAccessToken(token: string) {
    const userId = this.resolveUserId(token)
    if (!userId) {
      throw new InvalidTokenError('No email credentials found. Please authenticate.')
    }

    const cached = this.verifyCache.get(userId)
    if (cached && Date.now() < cached.expiresAt) {
      return {
        token,
        clientId: 'email-mcp',
        scopes: ['email:read', 'email:write'],
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        extra: { userId }
      }
    }

    const accounts = this.userAccounts.get(userId)
    if (!accounts || accounts.length === 0) {
      throw new InvalidTokenError('No email accounts found for this user')
    }

    this.verifyCache.set(userId, {
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

  private cleanup(): void {
    const now = Date.now()
    for (const [key, val] of this.pendingAuths) {
      if (now - val.createdAt > PENDING_AUTH_TTL) this.pendingAuths.delete(key)
    }
    for (const [key, val] of this.authCodes) {
      if (now - val.createdAt > AUTH_CODE_TTL) this.authCodes.delete(key)
    }
    for (const [key, val] of this.bearerTokens) {
      if (now - val.createdAt > BEARER_TOKEN_TTL) this.bearerTokens.delete(key)
    }
    for (const [key, val] of this.pendingBinds) {
      if (now > val.expiresAt) this.pendingBinds.delete(key)
    }
    for (const [key, val] of this.boundTokens) {
      if (now - val.createdAt > BEARER_TOKEN_TTL) this.boundTokens.delete(key)
    }
    for (const [key, val] of this.verifyCache) {
      if (now > val.expiresAt) this.verifyCache.delete(key)
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
  const impl = new EmailAuthProviderImpl(config)

  return {
    provider: impl,
    clientStore: impl.clientStore,
    pendingAuths: impl.pendingAuths,
    authCodes: impl.authCodes,
    bearerTokens: impl.bearerTokens,
    boundTokens: impl.boundTokens,
    userAccounts: impl.userAccounts,
    resolveAccounts: (token: string) => impl.resolveAccounts(token),
    resolveUserId: (token: string) => impl.resolveUserId(token),
    cleanupInterval: impl.cleanupInterval
  }
}
