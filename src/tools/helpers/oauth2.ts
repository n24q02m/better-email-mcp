/**
 * OAuth2 for Outlook.com / Hotmail / Live accounts
 *
 * Microsoft has disabled Basic Auth for Outlook/Hotmail/Live accounts (September 2024).
 * This module implements Device Code Grant (RFC 8628) for CLI-based auth,
 * persistent token storage, and automatic token refresh.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { tryOpenBrowser } from '@n24q02m/mcp-core'
import type { CredStoreLike } from '../../auth/in-memory-cred-store.js'
import { currentSub } from '../../auth/subject-context.js'
import { getMarkSetupComplete, setState } from '../../credential-state.js'
import { isSafeUrl } from './security.js'

// Microsoft OAuth2 endpoints — "consumers" tenant for personal Microsoft accounts
const TENANT = 'consumers'
const AUTH_BASE = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0`
const DEVICE_CODE_URL = `${AUTH_BASE}/devicecode`
const TOKEN_URL = `${AUTH_BASE}/token`

// IMAP + SMTP + offline_access (for refresh tokens)
// Full resource URL with outlook.office.com — required for personal Microsoft accounts.
// outlook.office.com (personal/MSA) vs outlook.office365.com (work/school/Entra ID).
// Short scopes (no URL) produce Microsoft Graph tokens that Exchange Online IMAP rejects.
const SCOPES = [
  'https://outlook.office.com/IMAP.AccessAsUser.All',
  'https://outlook.office.com/SMTP.Send',
  'offline_access'
]

// Time constants
const MS_PER_SECOND = 1000
const DEFAULT_POLLING_INTERVAL_SECONDS = 5
const SLOW_DOWN_BACKOFF_MS = 5000
const TOKEN_REFRESH_BUFFER_SECONDS = 300

// Persistent token storage
const CONFIG_DIR = join(homedir(), '.better-email-mcp')
const TOKEN_FILE = join(CONFIG_DIR, 'tokens.json')

export interface OAuth2Tokens {
  accessToken: string
  refreshToken: string
  expiresAt: number // Unix timestamp (seconds)
  clientId: string
}

interface TokenStore {
  [email: string]: OAuth2Tokens
}

interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
  message: string
  error?: string
  error_description?: string
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  error?: string
  error_description?: string
}

/**
 * Type guard to validate OAuth2Tokens structure
 */
export function isValidTokens(data: unknown): data is OAuth2Tokens {
  if (!data || typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  return (
    typeof d.accessToken === 'string' &&
    d.accessToken.length > 0 &&
    typeof d.refreshToken === 'string' &&
    d.refreshToken.length > 0 &&
    typeof d.expiresAt === 'number' &&
    !Number.isNaN(d.expiresAt) &&
    d.expiresAt > 0 &&
    typeof d.clientId === 'string' &&
    d.clientId.length > 0
  )
}

/**
 * Type guard to validate TokenStore structure
 */
export function isValidTokenStore(data: unknown): data is TokenStore {
  if (!data || typeof data !== 'object' || data === null || Array.isArray(data)) return false
  const d = data as Record<string, unknown>
  return Object.values(d).every(isValidTokens)
}

/**
 * Safely parse a JSON string into a TokenStore, hardening against prototype pollution.
 * Returns null if the JSON is malformed or validation fails.
 */
function parseTokenStore(jsonString: string): TokenStore | null {
  try {
    const parsed = JSON.parse(jsonString)
    if (!isValidTokenStore(parsed)) {
      return null
    }

    // Transfer to a null-prototype object
    const safe = Object.create(null)
    Object.assign(safe, parsed)

    // Explicitly delete prototype-polluting keys just in case
    // biome-ignore lint/suspicious/noProto: Hardening against prototype pollution by removing the raw __proto__ key if passed in JSON.
    delete safe.__proto__
    delete safe.constructor
    delete safe.prototype

    return safe as TokenStore
  } catch {
    return null
  }
}

/** Outlook/Hotmail/Live domains that require OAuth2 */
const OUTLOOK_DOMAINS = new Set(['outlook.com', 'hotmail.com', 'live.com'])

/**
 * Check if an email address belongs to an Outlook/Hotmail/Live domain
 */
export function isOutlookDomain(email: string): boolean {
  const atIndex = email.indexOf('@')
  if (atIndex === -1) return false
  const domain = email.substring(atIndex + 1).toLowerCase()
  return OUTLOOK_DOMAINS.has(domain)
}

// Bundled Azure AD public client ID for better-email-mcp.
// Public clients have no secret — this is safe to embed (like Thunderbird's client ID).
// Override with OUTLOOK_CLIENT_ID env var if you want to use your own Azure AD app.
const DEFAULT_CLIENT_ID = 'd56f8c71-9f7c-43f4-9934-be29cb6e77b0'

/**
 * Get the Azure AD client ID for OAuth2.
 * Uses bundled client ID by default, can be overridden via OUTLOOK_CLIENT_ID env var.
 */
export function getClientId(): string {
  return process.env.OUTLOOK_CLIENT_ID || DEFAULT_CLIENT_ID
}

/**
 * Outlook token persistence — embed in the per-sub credential blob on
 * Cloudflare / HTTP multi-user deploys, fall back to the email-keyed
 * ``tokens.json`` file for single-user / stdio.
 *
 * The HTTP transport injects (``setOutlookTokenStore``) the SAME per-sub store
 * instance it uses for accounts, so a token write and a later account read
 * share ONE per-sub cache (coherent across a container instance; survives
 * recreate because the underlying KV is external). Tokens live under the
 * ``outlookTokens`` field of ``subs/<sub>/config`` — the embed design
 * (2026-06-16): no separate token KV namespace, mirroring better-notion-mcp.
 * When no store is injected (stdio never starts the HTTP transport) the legacy
 * file path runs. See ``feedback_cf_container_ts_deploy_gotchas`` (read-side warm).
 */
let outlookTokenStore: CredStoreLike | null = null

/** Inject the per-sub credential store used for embedding Outlook tokens.
 *
 * When the store is set (HTTP multi-user mode), device-code sessions are
 * persisted to KV so the background poll survives container sleep/recreate.
 * On container wake, the KV entry is checked in ``ensureValidToken()`` before
 * starting a fresh device-code flow, and the poll is resumed automatically.
 */
export function setOutlookTokenStore(store: CredStoreLike | null): void {
  outlookTokenStore = store
}

/**
 * In-memory cache for the FILE path ONLY (single-user). The embed path relies
 * on the injected per-sub store's own cache, so it never reads/writes this
 * global — doing so would bleed one sub's tokens into another's read.
 */
let cachedTokenStore: TokenStore | null = null

/** Exposed for testing */
export function _resetTokenCache(): void {
  cachedTokenStore = null
}

/** Resolve the sub scope: an explicit arg wins; ``undefined`` => ``currentSub()``. */
function resolveScope(sub: string | null | undefined): string | null {
  return sub === undefined ? currentSub() : sub
}

/**
 * Load stored OAuth2 tokens for an email account (optionally for an explicit
 * ``sub``; absent => the current request scope). Returns null if none stored.
 */
export async function loadStoredTokens(email: string, sub?: string | null): Promise<OAuth2Tokens | null> {
  const scope = resolveScope(sub)
  const key = email.toLowerCase()

  // Embed path: read the per-sub blob's outlookTokens map. The injected store's
  // own cache gives R2 coherence; never touch the global cachedTokenStore here.
  if (outlookTokenStore && scope) {
    try {
      const blob = await outlookTokenStore.load(scope)
      const map = blob?.outlookTokens as TokenStore | undefined
      const tok = map?.[key]
      return tok && isValidTokens(tok) ? tok : null
    } catch {
      return null
    }
  }

  // File path (single-user / stdio).
  try {
    if (cachedTokenStore) {
      return cachedTokenStore[key] || null
    }
    const data = await readFile(TOKEN_FILE, 'utf-8')
    const store = parseTokenStore(data)
    if (!store) {
      return null
    }
    cachedTokenStore = store
    return store[key] || null
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code !== 'ENOENT') {
      // Ignore parse errors or other issues, return null
    }
    return null
  }
}

/**
 * Emails (keys) of the stored Outlook token map for the given sub
 * (``null`` = single-user / file store). Used at startup by credential-state to
 * synthesize the ``email:oauth2`` credential string without a raw FS read.
 */
export async function loadOutlookEmails(sub: string | null): Promise<string[]> {
  if (outlookTokenStore && sub) {
    try {
      const blob = await outlookTokenStore.load(sub)
      const map = blob?.outlookTokens as TokenStore | undefined
      return map && isValidTokenStore(map) ? Object.keys(map).filter((k) => k.includes('@')) : []
    } catch {
      return []
    }
  }
  try {
    const data = await readFile(TOKEN_FILE, 'utf-8')
    const store = parseTokenStore(data)
    return store ? Object.keys(store).filter((k) => k.includes('@')) : []
  } catch {
    return []
  }
}

/**
 * Persist OAuth2 tokens. Embed path (a sub + an injected store): load the
 * current per-sub blob fresh, merge the token into ``outlookTokens``, write it
 * back — preserving ``accounts``. The per-sub Container DO is single-threaded so
 * this load-then-save is atomic enough, and R1 (``sleepAfter >= 20m``) keeps the
 * device-code poll's target instance alive. File path (single-user / stdio):
 * the legacy 0600 ``tokens.json`` write.
 */
export async function saveTokens(email: string, tokens: OAuth2Tokens, sub?: string | null): Promise<void> {
  const scope = resolveScope(sub)
  const key = email.toLowerCase()

  if (outlookTokenStore && scope) {
    const blob: Record<string, unknown> = (await outlookTokenStore.load(scope)) ?? {}
    const map: TokenStore = { ...(blob.outlookTokens as TokenStore | undefined) }
    map[key] = tokens
    // If there is a pending device-code session that just completed for this
    // email, clear it from KV so stale entries don't survive restart.
    const pending = blob.pendingDeviceCode as PendingDeviceCodeEntry | undefined
    const updated: Record<string, unknown> = { ...blob, outlookTokens: map }
    if (pending && pending.email === key) {
      delete updated.pendingDeviceCode
    }
    await outlookTokenStore.save(scope, updated)
    return
  }

  saveTokensToFile(key, tokens)
}

/**
 * Legacy email-keyed ``tokens.json`` write (single-user / stdio). Synchronous so
 * the file side-effect runs before ``saveTokens`` yields — preserving the
 * historical fire-and-forget contract. Creates the config dir if needed; 0600.
 */
function saveTokensToFile(emailKey: string, tokens: OAuth2Tokens): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })
  }

  let store: TokenStore = cachedTokenStore || {}
  try {
    if (!cachedTokenStore && existsSync(TOKEN_FILE)) {
      const data = readFileSync(TOKEN_FILE, 'utf-8')
      const parsedStore = parseTokenStore(data)
      if (parsedStore) {
        store = parsedStore
      } else {
        store = {}
      }
    }
  } catch {
    // Start fresh if file is corrupted
    store = {}
  }

  store[emailKey] = tokens
  cachedTokenStore = store
  writeFileSync(TOKEN_FILE, JSON.stringify(store, null, 2), { mode: 0o600 })
}

/**
 * Refresh an access token using the stored refresh token.
 * Microsoft may rotate the refresh token on each use.
 */
export async function refreshAccessToken(clientId: string, refreshToken: string): Promise<TokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: SCOPES.join(' ')
    })
  })

  const data = (await response.json()) as TokenResponse

  if (data.error) {
    throw new Error(`Token refresh failed: ${data.error_description || data.error}`)
  }

  return data
}

/**
 * Track pending Device Code auth flows so we don't request new codes on every retry.
 * Maps email → { verificationUri, userCode, expiresAt }
 */
interface PendingAuth {
  verificationUri: string
  userCode: string
  expiresAt: number
}
const pendingAuths = new Map<string, PendingAuth>()

/** Exposed for testing */
export function _getPendingAuths(): Map<string, PendingAuth> {
  return pendingAuths
}

// --- Device-code KV persistence (survives container sleep/recreate on CF) ---

/**
 * Device-code session persisted to KV so the poll can resume after container
 * sleep/recreate (the poll's target DO instance survives via the KV copy).
 *
 * The ``expiresAt`` field uses the same millisecond base as ``Date.now()``,
 * consistent with the RAM ``PendingAuth`` map.
 */
interface PendingDeviceCodeEntry {
  verificationUri: string
  userCode: string
  expiresAt: number
  deviceCode: string
  interval: number
  email: string
}

/** Persist the device-code session to KV under the sub's config blob. */
async function persistPendingDeviceCode(sub: string, entry: PendingDeviceCodeEntry): Promise<void> {
  if (!outlookTokenStore) return
  const blob: Record<string, unknown> = (await outlookTokenStore.load(sub)) ?? { accounts: [] }
  await outlookTokenStore.save(sub, { ...blob, pendingDeviceCode: entry })
}

/** Load a pending device-code session from KV, returning null if absent or expired. */
async function loadPendingDeviceCode(sub: string): Promise<PendingDeviceCodeEntry | null> {
  if (!outlookTokenStore) return null
  try {
    const blob = await outlookTokenStore.load(sub)
    if (!blob) return null
    const entry = blob.pendingDeviceCode as PendingDeviceCodeEntry | undefined
    if (!entry) return null
    // Guard against stale entries (past expiry) so we don't resume a dead poll.
    if (entry.expiresAt <= Date.now()) return null
    return entry
  } catch {
    return null
  }
}

/** Clear the pending device-code session from the KV blob (best-effort). */
async function clearPendingDeviceCode(sub: string): Promise<void> {
  if (!outlookTokenStore) return
  try {
    const blob: Record<string, unknown> = (await outlookTokenStore.load(sub)) ?? {}
    if (blob.pendingDeviceCode === undefined) return
    const { pendingDeviceCode: _, ...rest } = blob
    await outlookTokenStore.save(sub, rest)
  } catch {
    // Best-effort — the poll retry / expiry logic already handles the stale case.
  }
}

/**
 * Dedupe + browser-open logic is delegated to ``mcp-core``'s
 * ``tryOpenBrowser``: it validates the URL (only http/https), uses
 * ``execFile`` to avoid shell injection, detects WSL, and dedupes repeat calls
 * for the same URL within a 5-minute window. Exported for backward compat
 * with tests that reset test state.
 */
/** Exposed for testing — no-op after mcp-core consolidation. */
export function _resetBrowserOpenDedupe(): void {
  // mcp-core owns the dedupe map now; this helper is retained only so that
  // older test files that still call it do not break. Tests that need a
  // fresh dedupe state should mock ``@n24q02m/mcp-core`` instead.
}

/**
 * Open a URL in the user's default browser safely. Wraps mcp-core's
 * ``tryOpenBrowser`` in a fire-and-forget fashion so OAuth callers do not
 * block on browser launch. Validates URL before opening to prevent injection.
 */
function openBrowser(url: string): void {
  if (isSafeUrl(url)) {
    void tryOpenBrowser(url)
  } else {
    console.error(`[SECURITY] Refused to open unsafe URL: ${url}`)
  }
}

/**
 * Request a device code from Microsoft's OAuth2 endpoint.
 */
async function requestDeviceCode(clientId: string): Promise<DeviceCodeResponse> {
  const response = await fetch(DEVICE_CODE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      scope: SCOPES.join(' ')
    })
  })

  const data = (await response.json()) as DeviceCodeResponse

  if (data.error || !data.user_code) {
    throw new Error(`Device code request failed: ${data.error_description || data.error || 'Unknown error'}`)
  }

  return data
}

/**
 * Poll for token in the background. Saves to disk when authorized.
 * Runs silently — errors are logged to stderr, not thrown.
 *
 * Optional `onComplete` callback is invoked after tokens are persisted to
 * disk so callers (HTTP transport) can signal setup completion to the
 * credential form via /setup-status.
 */
function startBackgroundPoll(
  clientId: string,
  deviceCode: string,
  interval: number,
  expiresIn: number,
  email: string,
  onComplete?: () => void,
  sub?: string | null
): void {
  const emailKey = email.toLowerCase()
  const deadline = Date.now() + expiresIn * MS_PER_SECOND
  let pollInterval = (interval || DEFAULT_POLLING_INTERVAL_SECONDS) * MS_PER_SECOND

  const poll = async () => {
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval))

      const response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: deviceCode
        })
      })

      const data = (await response.json()) as TokenResponse

      if (data.access_token) {
        const now = Math.floor(Date.now() / MS_PER_SECOND)
        await saveTokens(
          email,
          {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: now + data.expires_in,
            clientId
          },
          sub
        )
        pendingAuths.delete(emailKey)
        // Also clear the device-code session from KV so it doesn't resume
        // stale after a future container recreate.
        if (outlookTokenStore && sub) {
          clearPendingDeviceCode(sub).catch(() => {
            /* best-effort */
          })
        }

        setState('configured')
        try {
          getMarkSetupComplete()?.('outlook')
        } catch {
          // Best-effort -- ignore hook errors.
        }

        if (onComplete) {
          try {
            onComplete()
          } catch {
            // Best-effort -- ignore callback errors.
          }
        }
        return
      }
      if (data.error === 'authorization_pending') continue
      if (data.error === 'slow_down') {
        pollInterval += SLOW_DOWN_BACKOFF_MS
        continue
      }

      // authorization_declined, expired_token, etc.
      pendingAuths.delete(emailKey)
      return
    }

    pendingAuths.delete(emailKey)
  }

  poll().catch(() => pendingAuths.delete(emailKey))
}

/**
 * Initiate the Device Code OAuth flow for an Outlook account without
 * throwing. Used by the HTTP /authorize callback to surface the sign-in
 * URL + user code to the custom credential form.
 *
 * If a pending auth already exists for this email (e.g. user resubmitted the
 * form), returns the existing codes instead of requesting new ones. The
 * background poll saves tokens on success and invokes ``onComplete`` so the
 * form can mark setup complete via GET /setup-status.
 *
 * ``sub`` is threaded EXPLICITLY (not read from ``currentSub()``) because the
 * /authorize callback that initiates this flow does not run inside the per-mcp
 * request scope — the JWT sub comes from ``onCredentialsSaved``'s context. The
 * detached background poll uses it to write the token to the right per-sub blob.
 */
export async function initiateOutlookDeviceCode(
  email: string,
  onComplete?: () => void,
  sub?: string | null
): Promise<{ verificationUri: string; userCode: string; expiresIn: number; interval: number }> {
  if (!email?.trim()) throw new Error('Email is required')
  const scope = resolveScope(sub)
  const emailKey = email.toLowerCase()
  const existing = pendingAuths.get(emailKey)
  if (existing && existing.expiresAt > Date.now()) {
    return {
      verificationUri: existing.verificationUri,
      userCode: existing.userCode,
      expiresIn: Math.max(1, Math.floor((existing.expiresAt - Date.now()) / MS_PER_SECOND)),
      interval: DEFAULT_POLLING_INTERVAL_SECONDS
    }
  }

  const clientId = getClientId()
  const codeData = await requestDeviceCode(clientId)

  pendingAuths.set(emailKey, {
    verificationUri: codeData.verification_uri,
    userCode: codeData.user_code,
    expiresAt: Date.now() + codeData.expires_in * MS_PER_SECOND
  })

  // Persist the device-code session to KV so it survives container
  // sleep/recreate on Cloudflare (sleepAfter can be <15m because the
  // poll resumes from KV on container wake).
  if (outlookTokenStore && scope) {
    persistPendingDeviceCode(scope, {
      verificationUri: codeData.verification_uri,
      userCode: codeData.user_code,
      expiresAt: Date.now() + codeData.expires_in * MS_PER_SECOND,
      deviceCode: codeData.device_code,
      interval: codeData.interval || DEFAULT_POLLING_INTERVAL_SECONDS,
      email: emailKey
    }).catch(() => {
      // Best-effort — the RAM map is the primary cache; KV is for survival.
    })
  }

  startBackgroundPoll(clientId, codeData.device_code, codeData.interval, codeData.expires_in, email, onComplete, scope)

  // Auto-open browser for desktop environments (best-effort; no-op in CI/E2E)
  openBrowser(codeData.verification_uri)

  return {
    verificationUri: codeData.verification_uri,
    userCode: codeData.user_code,
    expiresIn: codeData.expires_in,
    interval: codeData.interval || DEFAULT_POLLING_INTERVAL_SECONDS
  }
}

/**
 * Ensure the account has a valid (non-expired) access token.
 *
 * If no tokens exist: initiates Device Code flow in the background and throws
 * an error containing the sign-in URL and code for the MCP client to display.
 * On retry, picks up tokens saved to disk by the background poll.
 *
 * If tokens exist but expired: refreshes automatically with 5-minute buffer.
 * Mutates account.oauth2 in place and persists to disk.
 */
export async function ensureValidToken(account: { email: string; oauth2?: OAuth2Tokens }): Promise<string> {
  // Try loading from disk (background auth may have saved tokens since last call)
  if (!account.oauth2) {
    const stored = await loadStoredTokens(account.email)
    if (stored) {
      account.oauth2 = stored
    }
  }

  if (!account.oauth2) {
    const emailKey = account.email.toLowerCase()

    // First, check KV for a pending device-code session that survived a
    // container sleep/recreate — resume the background poll if found.
    const sub = currentSub()
    if (sub && outlookTokenStore) {
      const kvPending = await loadPendingDeviceCode(sub)
      if (kvPending && kvPending.email === emailKey) {
        // Populate RAM cache so retries within the same container instance
        // see the pending auth without another KV round-trip.
        pendingAuths.set(emailKey, {
          verificationUri: kvPending.verificationUri,
          userCode: kvPending.userCode,
          expiresAt: kvPending.expiresAt
        })
        startBackgroundPoll(
          getClientId(),
          kvPending.deviceCode,
          kvPending.interval,
          Math.max(1, Math.ceil((kvPending.expiresAt - Date.now()) / MS_PER_SECOND)),
          kvPending.email,
          undefined,
          sub
        )
        throw new Error(
          `Outlook sign-in in progress for ${account.email}.\n` +
            `Visit: ${kvPending.verificationUri}\n` +
            `Enter code: ${kvPending.userCode}\n\n` +
            `After signing in, retry your request.`
        )
      }
    }

    const pending = pendingAuths.get(emailKey)

    if (pending && pending.expiresAt > Date.now()) {
      // Auth flow already in progress — show same code
      throw new Error(
        `Outlook sign-in in progress for ${account.email}.\n` +
          `Visit: ${pending.verificationUri}\n` +
          `Enter code: ${pending.userCode}\n\n` +
          `After signing in, retry your request.`
      )
    }

    // Start new Device Code flow
    const clientId = getClientId()
    const codeData = await requestDeviceCode(clientId)

    pendingAuths.set(emailKey, {
      verificationUri: codeData.verification_uri,
      userCode: codeData.user_code,
      expiresAt: Date.now() + codeData.expires_in * MS_PER_SECOND
    })

    // Also persist the device-code session to KV so it survives container sleep.
    if (outlookTokenStore && sub) {
      persistPendingDeviceCode(sub, {
        verificationUri: codeData.verification_uri,
        userCode: codeData.user_code,
        expiresAt: Date.now() + codeData.expires_in * MS_PER_SECOND,
        deviceCode: codeData.device_code,
        interval: codeData.interval || DEFAULT_POLLING_INTERVAL_SECONDS,
        email: emailKey
      }).catch(() => {
        // Best-effort — the RAM map is the primary cache.
      })
    }

    // Capture the sub now (tool-call request scope) so the detached poll writes
    // the token to the right per-sub blob even after this request returns.
    startBackgroundPoll(
      clientId,
      codeData.device_code,
      codeData.interval,
      codeData.expires_in,
      account.email,
      undefined,
      sub
    )

    // Auto-open browser for desktop environments
    openBrowser(codeData.verification_uri)

    throw new Error(
      `Outlook OAuth2 sign-in required for ${account.email}.\n` +
        `Visit: ${codeData.verification_uri}\n` +
        `Enter code: ${codeData.user_code}\n\n` +
        `After signing in, retry your request.`
    )
  }

  const now = Math.floor(Date.now() / MS_PER_SECOND)
  const buffer = TOKEN_REFRESH_BUFFER_SECONDS // 5-minute safety buffer

  if (account.oauth2.expiresAt > now + buffer) {
    return account.oauth2.accessToken
  }

  // Token expired or about to expire — refresh
  const newTokens = await refreshAccessToken(account.oauth2.clientId, account.oauth2.refreshToken)

  account.oauth2.accessToken = newTokens.access_token
  account.oauth2.expiresAt = now + newTokens.expires_in
  // Microsoft may issue a new refresh token — always update if provided
  if (newTokens.refresh_token) {
    account.oauth2.refreshToken = newTokens.refresh_token
  }

  // Persist updated tokens (embed under currentSub() when in a request scope,
  // else the legacy file path for single-user / stdio).
  await saveTokens(account.email, account.oauth2)

  return newTokens.access_token
}

/**
 * Save Outlook tokens received via mcp-core delegated OAuth callback.
 *
 * mcp-core's ``TokenCallback`` delivers ``OAuthTokens`` (Record<string, unknown>).
 * Adapts that to the existing ``saveTokens(email, OAuth2Tokens)`` format so
 * remote-relay mode shares the same token file as local-relay / CLI auth flows.
 *
 * The email is extracted from the token's ``email`` field (set by the upstream
 * form) or from ``OUTLOOK_EMAIL`` env var if the caller knows the account.
 * When neither is present, tokens are stored under the ``id_token`` subject
 * claim as a fallback (uncommon in device-code flows).
 */
export async function saveOutlookTokens(tokens: Record<string, unknown>): Promise<void> {
  const email = typeof tokens.email === 'string' ? tokens.email : (process.env.OUTLOOK_EMAIL ?? 'outlook-device-code')
  const now = Math.floor(Date.now() / MS_PER_SECOND)
  const expiresIn = typeof tokens.expires_in === 'number' ? tokens.expires_in : 3600
  await saveTokens(email, {
    accessToken: typeof tokens.access_token === 'string' ? tokens.access_token : '',
    refreshToken: typeof tokens.refresh_token === 'string' ? tokens.refresh_token : '',
    expiresAt: now + expiresIn,
    clientId: typeof tokens.client_id === 'string' ? tokens.client_id : getClientId()
  })

  setState('configured')
  try {
    getMarkSetupComplete()?.('outlook')
  } catch {
    // Best-effort -- ignore hook errors.
  }
}

/**
 * Interactive Device Code flow for CLI-based OAuth2 authentication.
 * Prints instructions to stderr and polls until user authorizes or timeout.
 * Used by `npx @n24q02m/better-email-mcp auth <email>`.
 */
export async function deviceCodeAuth(email: string, clientId?: string): Promise<OAuth2Tokens> {
  if (!email?.trim()) throw new Error('Email is required')
  const resolvedClientId = clientId || getClientId()
  const codeData = await requestDeviceCode(resolvedClientId)

  console.error(`\nTo sign in, visit: ${codeData.verification_uri}`)
  console.error(`Enter code: ${codeData.user_code}\n`)
  console.error('Waiting for authorization...')

  const interval = (codeData.interval || DEFAULT_POLLING_INTERVAL_SECONDS) * MS_PER_SECOND
  const deadline = Date.now() + codeData.expires_in * MS_PER_SECOND
  let pollInterval = interval

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval))

    const tokenResponse = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: resolvedClientId,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: codeData.device_code
      })
    })

    const tokenData = (await tokenResponse.json()) as TokenResponse

    if (tokenData.access_token) {
      const now = Math.floor(Date.now() / MS_PER_SECOND)
      const tokens: OAuth2Tokens = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: now + tokenData.expires_in,
        clientId: resolvedClientId
      }

      await saveTokens(email, tokens)
      setState('configured')
      try {
        getMarkSetupComplete()?.('outlook')
      } catch {
        // Best-effort -- ignore hook errors.
      }
      console.error(`\nSuccess! Token saved for ${email}`)
      return tokens
    }

    if (tokenData.error === 'authorization_pending') {
      continue
    }

    if (tokenData.error === 'slow_down') {
      pollInterval += SLOW_DOWN_BACKOFF_MS // Back off as requested by server
      continue
    }

    // Other errors (expired_token, authorization_declined, bad_verification_code)
    throw new Error(`Authorization failed: ${tokenData.error_description || tokenData.error}`)
  }

  throw new Error('Authorization timed out. Please try again.')
}
