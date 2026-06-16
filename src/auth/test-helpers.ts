/**
 * Shared Cloudflare-migration test doubles: a fake KV `Http` that satisfies
 * mcp-core's `CfKvBackend` wire contract, plus a multi-user env preset. Lets the
 * credential-layer unit tests run offline and reproducibly against the same
 * backend the deployed Worker uses.
 */

/**
 * Structural shape of mcp-core's injectable `Http` (storage/backends.ts):
 * `request(method, url, data?, headers?) -> { status, body }`. Declared locally
 * so the harness does not depend on `Http` being re-exported from the subpath.
 */
export interface KvHttp {
  request(
    method: string,
    url: string,
    data?: Uint8Array | Buffer,
    headers?: Record<string, string>
  ): Promise<{ status: number; body: Uint8Array | Buffer }>
}

/**
 * In-memory KV that implements the `CfKvBackend` wire contract exactly:
 * PUT -> 200, GET -> 200/404, DELETE -> 200/404. The key is the last URL
 * segment, percent-decoded (CfKvBackend `encodeURIComponent`s the whole key).
 */
export class FakeKvHttp implements KvHttp {
  readonly store = new Map<string, Uint8Array>()

  async request(
    method: string,
    url: string,
    data?: Uint8Array | Buffer
  ): Promise<{ status: number; body: Uint8Array }> {
    const key = decodeURIComponent(url.slice(url.lastIndexOf('/') + 1))
    if (method === 'PUT') {
      this.store.set(key, data ? new Uint8Array(data) : new Uint8Array())
      return { status: 200, body: new Uint8Array() }
    }
    if (method === 'GET') {
      const v = this.store.get(key)
      return v ? { status: 200, body: v } : { status: 404, body: new Uint8Array() }
    }
    if (method === 'DELETE') {
      const existed = this.store.delete(key)
      return { status: existed ? 200 : 404, body: new Uint8Array() }
    }
    throw new Error(`unexpected method ${method}`)
  }
}

/** Apply the canonical CF multi-user env preset (dummy secrets only). */
export function applyCfEnv(): void {
  process.env.CREDENTIAL_SECRET = 'test-credential-secret'
  process.env.MCP_STORAGE_BACKEND = 'cf-kv'
  process.env.MCP_KV_BASE_URL = 'http://kv.internal'
  process.env.MCP_TRANSPORT = 'http'
}

/** Restore the single-user (LocalFs) default by clearing the CF env. */
export function clearCfEnv(): void {
  for (const k of ['CREDENTIAL_SECRET', 'MCP_STORAGE_BACKEND', 'MCP_KV_BASE_URL', 'MCP_TRANSPORT']) {
    delete process.env[k]
  }
}
