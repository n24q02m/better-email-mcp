/**
 * KV write-through per-sub credential store (Cloudflare deploy).
 *
 * The single per-sub store for HTTP multi-user mode on Cloudflare: it replaces
 * the ephemeral `InMemoryCredStore` so credentials AND Outlook OAuth tokens
 * survive container delete+recreate without re-auth. Everything for one subject
 * lives in ONE encrypted blob at `better-email/subs/<sub>/config`
 * (`{ accounts, outlookTokens? }`) — the embed design (per the 2026-06-16
 * decision record): no separate `tokens/<provider>` namespace, mirroring the
 * verified-live better-notion-mcp pattern.
 *
 * The in-memory Map is a read cache; the durable layer is Workers KV reached via
 * the Worker's `kv.internal` outbound handler (MCP_KV_BASE_URL). The blob is
 * encrypted by mcp-core's PerPluginStore (AES-256-GCM) before it hits KV — this
 * module NEVER re-implements crypto. On load the decrypted blob is schema-checked
 * before it is trusted (a malformed blob is treated as no-credentials → re-auth,
 * never thrown to the caller).
 */
import { backendFromEnv, CfKvBackend, PerPluginStore } from '@n24q02m/mcp-core/storage'
import type { CredentialPayload, CredStoreLike } from './in-memory-cred-store.js'

const PLUGIN_NAME = 'better-email'

// Minimal structural shape of mcp-core's injectable Http (storage/backends.ts).
// Declared locally so the module does not depend on Http being re-exported from
// the package subpath.
interface KvHttp {
  request(
    method: string,
    url: string,
    data?: Uint8Array | Buffer,
    headers?: Record<string, string>
  ): Promise<{ status: number; body: Uint8Array | Buffer }>
}

interface PerSubCredStoreOptions {
  // Injectable Http for CfKvBackend (tests). Production: backendFromEnv() builds
  // a CfKvBackend from MCP_STORAGE_BACKEND=cf-kv + MCP_KV_BASE_URL.
  http?: KvHttp
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

function isValidServer(s: unknown): boolean {
  if (typeof s !== 'object' || s === null) return false
  const srv = s as Record<string, unknown>
  return (
    isNonEmptyString(srv.host) &&
    Number.isInteger(srv.port) &&
    (srv.port as number) > 0 &&
    typeof srv.secure === 'boolean'
  )
}

function isValidOAuth2(o: unknown): boolean {
  if (typeof o !== 'object' || o === null) return false
  const t = o as Record<string, unknown>
  // accessToken/refreshToken are strings when present; an in-progress device-code
  // account may carry empty strings, so do not require non-empty here.
  return typeof t.accessToken === 'string' && typeof t.refreshToken === 'string'
}

function isValidAccount(a: unknown): boolean {
  if (typeof a !== 'object' || a === null) return false
  const acc = a as Record<string, unknown>
  // id/email must be non-empty; password is a string but may be empty for OAuth2
  // accounts (no password). imap/smtp must be well-formed server configs.
  if (!isNonEmptyString(acc.id) || !isNonEmptyString(acc.email) || typeof acc.password !== 'string') return false
  if (!isValidServer(acc.imap) || !isValidServer(acc.smtp)) return false
  if (acc.oauth2 !== undefined && !isValidOAuth2(acc.oauth2)) return false
  return true
}

/**
 * Validate the decrypted credential blob before trusting it (carryover from the
 * closed #851). A blob must be an object whose `accounts` is an array of
 * well-formed AccountConfig. Extra fields (e.g. `outlookTokens`) pass through.
 */
export function isValidCredentialPayload(data: unknown): data is CredentialPayload {
  if (typeof data !== 'object' || data === null) return false
  const accounts = (data as { accounts?: unknown }).accounts
  if (!Array.isArray(accounts)) return false
  return accounts.every(isValidAccount)
}

export class PerSubCredStore implements CredStoreLike {
  private cache = new Map<string, CredentialPayload>()
  private backend: CfKvBackend | ReturnType<typeof backendFromEnv>

  constructor(opts: PerSubCredStoreOptions = {}) {
    // CfKvBackend is positional: (baseUrl, token?, http?). No KV bearer token is
    // needed (the Worker's kv.internal handler authorizes via the binding), so
    // pass undefined for token and inject http for tests.
    this.backend = opts.http
      ? new CfKvBackend(process.env.MCP_KV_BASE_URL ?? 'http://kv.internal', undefined, opts.http as never)
      : backendFromEnv()
  }

  // One blob per (plugin, sub) at `better-email/subs/<sub>/config`.
  private storeFor(sub: string): PerPluginStore {
    return new PerPluginStore(PLUGIN_NAME, sub, this.backend)
  }

  async save(sub: string, creds: CredentialPayload): Promise<void> {
    const blob: CredentialPayload = { ...creds }
    this.cache.set(sub, blob)
    await this.storeFor(sub).save(blob)
  }

  async load(sub: string): Promise<CredentialPayload | null> {
    const cached = this.cache.get(sub)
    if (cached !== undefined) return cached
    try {
      const data = (await this.storeFor(sub).load()) as CredentialPayload | null
      if (data !== null && isValidCredentialPayload(data)) {
        this.cache.set(sub, data)
        return data
      }
    } catch {
      // corrupt/absent blob -> treat as no credentials (re-auth), never throw.
    }
    return null
  }

  async clear(sub: string): Promise<void> {
    this.cache.delete(sub)
    await this.storeFor(sub).clear()
  }

  // KV exposes no list operation through the outbound handler; this is a
  // best-effort cache-only view (production code paths never depend on it — it
  // exists only to satisfy the shared interface / tests).
  async listSubs(): Promise<string[]> {
    return [...this.cache.keys()]
  }

  // Startup readiness probe: confirm the container -> Worker `kv.internal`
  // outbound path is wired BEFORE the first credential write (hits the Worker's
  // kvOutbound `__ready` branch). Throws if outbound interception is broken so
  // the HTTP transport can log it loudly at startup.
  async ready(): Promise<void> {
    await this.backend.get('__ready')
  }
}
