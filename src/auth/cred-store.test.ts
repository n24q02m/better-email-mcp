import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PerSubCredStore } from './cred-store.js'
import { applyCfEnv, clearCfEnv, FakeKvHttp } from './test-helpers.js'

function acct(email: string) {
  return {
    id: email,
    email,
    password: 'app-pass',
    authType: 'password' as const,
    imap: { host: 'imap.example.com', port: 993, secure: true },
    smtp: { host: 'smtp.example.com', port: 465, secure: true }
  }
}

describe('PerSubCredStore', () => {
  beforeEach(() => applyCfEnv())
  afterEach(() => clearCfEnv())

  it('write-through encrypts the blob to KV and a cold store recovers it', async () => {
    const http = new FakeKvHttp()
    const store = new PerSubCredStore({ http })
    await store.save('alice', { accounts: [acct('a@example.com')] })

    const stored = [...http.store.entries()].find(([k]) => k.includes('subs/alice/config'))
    expect(stored).toBeDefined()
    // ciphertext, not plaintext
    expect(new TextDecoder().decode(stored?.[1] ?? new Uint8Array())).not.toContain('a@example.com')

    const cold = new PerSubCredStore({ http })
    const loaded = await cold.load('alice')
    expect((loaded?.accounts as ReturnType<typeof acct>[])?.[0]?.email).toBe('a@example.com')
  })

  it('embeds outlookTokens alongside accounts in the same per-sub blob', async () => {
    const http = new FakeKvHttp()
    await new PerSubCredStore({ http }).save('bob', {
      accounts: [acct('b@outlook.com')],
      outlookTokens: {
        'b@outlook.com': { accessToken: 't', refreshToken: 'r', expiresAt: Date.now() + 3600000, clientId: 'c' }
      }
    })
    const cold = new PerSubCredStore({ http })
    const loaded = await cold.load('bob')
    const tokens = (loaded as { outlookTokens?: Record<string, { accessToken: string }> })?.outlookTokens
    expect(tokens?.['b@outlook.com']?.accessToken).toBe('t')
  })

  it('keeps distinct subs isolated', async () => {
    const http = new FakeKvHttp()
    const store = new PerSubCredStore({ http })
    await store.save('alice', { accounts: [acct('a@example.com')] })
    await store.save('bob', { accounts: [acct('b@example.com')] })
    const cold = new PerSubCredStore({ http })
    expect((((await cold.load('alice'))?.accounts as ReturnType<typeof acct>[]) ?? [])[0]?.email).toBe('a@example.com')
    expect((((await cold.load('bob'))?.accounts as ReturnType<typeof acct>[]) ?? [])[0]?.email).toBe('b@example.com')
  })

  it('rejects a malformed blob on load (schema validation -> null, never throws)', async () => {
    const http = new FakeKvHttp()
    // Persist a structurally-invalid blob (accounts present but each account is
    // missing required fields), then read it back with a cold (cache-empty) store.
    await new PerSubCredStore({ http }).save('mal', { accounts: [{ email: '', nope: true }] })
    const cold = new PerSubCredStore({ http })
    expect(await cold.load('mal')).toBeNull()
  })

  it('serves the in-memory cache after a save (no cold round-trip needed)', async () => {
    const store = new PerSubCredStore({ http: new FakeKvHttp() })
    await store.save('alice', { accounts: [acct('a@example.com')] })
    expect((await store.load('alice'))?.accounts).toHaveLength(1)
  })

  it('clear removes from both cache and KV', async () => {
    const http = new FakeKvHttp()
    const store = new PerSubCredStore({ http })
    await store.save('alice', { accounts: [acct('a@example.com')] })
    await store.clear('alice')
    expect(await store.load('alice')).toBeNull()
    expect(await new PerSubCredStore({ http }).load('alice')).toBeNull()
  })

  it('ready() resolves when the kv.internal outbound path is reachable, rejects when broken', async () => {
    await expect(new PerSubCredStore({ http: new FakeKvHttp() }).ready()).resolves.toBeUndefined()
    const broken = new PerSubCredStore({
      http: {
        async request(): Promise<{ status: number; body: Uint8Array }> {
          throw new Error('getaddrinfo ENOTFOUND kv.internal')
        }
      }
    })
    await expect(broken.ready()).rejects.toThrow(/kv\.internal/)
  })

  it('rejects an account with an invalid authType', async () => {
    const http = new FakeKvHttp()
    const a = acct('invalid@example.com') as any
    a.authType = 'invalid-type'
    await new PerSubCredStore({ http }).save('sub', { accounts: [a] })
    const cold = new PerSubCredStore({ http })
    expect(await cold.load('sub')).toBeNull()
  })

  it('rejects a payload with malformed outlookTokens', async () => {
    const http = new FakeKvHttp()
    await new PerSubCredStore({ http }).save('sub', {
      accounts: [acct('a@example.com')],
      outlookTokens: { 'a@example.com': { accessToken: '', refreshToken: 'r', expiresAt: 1, clientId: 'c' } } // empty accessToken
    })
    const cold = new PerSubCredStore({ http })
    expect(await cold.load('sub')).toBeNull()
  })

  it('hardens against prototype pollution on load', async () => {
    const http = new FakeKvHttp()
    const payload = JSON.parse('{"accounts": [], "__proto__": {"polluted": true}}')
    await new PerSubCredStore({ http }).save('sub', payload)

    const cold = new PerSubCredStore({ http })
    const loaded = (await cold.load('sub')) as any
    expect(loaded).not.toBeNull()
    expect(loaded.polluted).toBeUndefined()
    expect(Object.getPrototypeOf(loaded)).toBeNull()
    // biome-ignore lint/suspicious/noProto: Verification of hardening
    expect(loaded.__proto__).toBeUndefined()
  })
})
