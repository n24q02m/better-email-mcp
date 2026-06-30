import { describe, expect, test, vi } from 'vitest'

// @cloudflare/containers imports `cloudflare:workers`, which only exists in the
// Workers runtime, so it cannot load under Node/vitest. Mock it: Container as a
// plain base class (assignment to the static outboundByHost just sets a property
// we can read back) + a ContainerProxy stub for the entrypoint re-export.
vi.mock('@cloudflare/containers', () => ({
  Container: class {
    env: unknown
    constructor(_ctx?: unknown, env?: unknown) {
      this.env = env ?? {}
    }
  },
  ContainerProxy: class {}
}))

import worker, { EmailContainer, OUTBOUND_BY_HOST } from '../src/worker.js'

describe('worker (KV-only)', () => {
  test('outbound registry has ONLY kv.internal (footgun 1 + KV-only: no d1/vectorize)', () => {
    const hosts = Object.keys(OUTBOUND_BY_HOST)
    expect(hosts).toEqual(['kv.internal'])
    expect(hosts).not.toContain('d1.internal')
    expect(hosts).not.toContain('vectorize.internal')
  })

  test('EmailContainer.outboundByHost was set via assignment (hits the inherited setter)', () => {
    const reg = (EmailContainer as unknown as { outboundByHost: Record<string, unknown> }).outboundByHost
    expect(Object.keys(reg)).toEqual(['kv.internal'])
  })

  test('kvOutbound answers the __ready readiness probe (E.1)', async () => {
    const env = { KV: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } }
    const resp = await OUTBOUND_BY_HOST['kv.internal']?.(
      new Request('http://kv.internal/__ready', { method: 'GET' }),
      env as never,
      {} as never
    )
    expect(resp?.status).toBe(200)
    expect(await resp?.json()).toEqual({ ready: true })
    // The probe must NOT touch the KV binding.
    expect(env.KV.get).not.toHaveBeenCalled()
  })

  test('kvOutbound round-trips bytes as ArrayBuffer (footgun 3) for GET/PUT/DELETE', async () => {
    const store = new Map<string, ArrayBuffer>()
    const env = {
      KV: {
        get: vi.fn(async (k: string) => store.get(k) ?? null),
        put: vi.fn(async (k: string, v: ArrayBuffer) => void store.set(k, v)),
        delete: vi.fn(async (k: string) => void store.delete(k))
      }
    }
    const handler = OUTBOUND_BY_HOST['kv.internal']
    const bytes = new Uint8Array([1, 2, 3, 255, 0]).buffer

    const put = await handler?.(
      new Request('http://kv.internal/better-email/subs/u1/config', { method: 'PUT', body: bytes }),
      env as never,
      {} as never
    )
    expect(put?.status).toBe(200)

    const get = await handler?.(
      new Request('http://kv.internal/better-email/subs/u1/config', { method: 'GET' }),
      env as never,
      {} as never
    )
    expect(get?.status).toBe(200)
    expect(new Uint8Array(await (get as Response).arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 255, 0]))

    const del = await handler?.(
      new Request('http://kv.internal/better-email/subs/u1/config', { method: 'DELETE' }),
      env as never,
      {} as never
    )
    expect(del?.status).toBe(200)
    const miss = await handler?.(
      new Request('http://kv.internal/better-email/subs/u1/config', { method: 'GET' }),
      env as never,
      {} as never
    )
    expect(miss?.status).toBe(404)
  })

  test('fetch routes every sub to the single "default" DO (single-DO collapse)', async () => {
    const stub = { fetch: vi.fn().mockResolvedValue(new Response('ok')) }
    const idFromName = vi.fn().mockReturnValue('id-token')
    const env = { EMAIL: { idFromName, get: vi.fn().mockReturnValue(stub) } }
    // Bearer with base64url payload {"sub":"alice"} — single-DO collapse routes it to "default"
    const payload = Buffer.from(JSON.stringify({ sub: 'alice' })).toString('base64url')
    const req = new Request('https://email.n24q02m.com/mcp', {
      headers: { authorization: `Bearer h.${payload}.s` }
    })
    await worker.fetch(req, env as never)
    expect(idFromName).toHaveBeenCalledWith('default')
    expect(stub.fetch).toHaveBeenCalled()
  })

  test('fetch falls back to "default" sub when no Bearer token (E.2 single-user DO)', async () => {
    const idFromName = vi.fn().mockReturnValue('id-default')
    const env = {
      EMAIL: { idFromName, get: vi.fn().mockReturnValue({ fetch: vi.fn().mockResolvedValue(new Response()) }) }
    }
    await worker.fetch(new Request('https://email.n24q02m.com/mcp'), env as never)
    expect(idFromName).toHaveBeenCalledWith('default')
  })

  test('fetch returns 404 when the EMAIL binding is absent', async () => {
    const resp = await worker.fetch(new Request('https://email.n24q02m.com/mcp'), {} as never)
    expect(resp.status).toBe(404)
  })

  test('defaultPort 8080 + sleepAfter is 5m (device-code session KV-persisted, no longer needs >=15m)', () => {
    const c = new EmailContainer(undefined as never, {} as never)
    expect(c.defaultPort).toBe(8080)
    expect(c.enableInternet).toBe(true)
    expect(c.sleepAfter).toBe('5m')
  })

  test('envVars forwards only set string keys, dropping empty/undefined', () => {
    const c = new EmailContainer(
      undefined as never,
      {
        PUBLIC_URL: 'https://email.n24q02m.com',
        MCP_STORAGE_BACKEND: 'cf-kv',
        OUTLOOK_CLIENT_ID: '', // empty -> dropped
        PORT: '8080'
      } as never
    )
    expect(c.envVars).toEqual({
      PUBLIC_URL: 'https://email.n24q02m.com',
      MCP_STORAGE_BACKEND: 'cf-kv',
      PORT: '8080'
    })
    expect(c.envVars).not.toHaveProperty('OUTLOOK_CLIENT_ID')
  })
})
