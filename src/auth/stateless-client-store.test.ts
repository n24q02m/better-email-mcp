import { describe, expect, it } from 'vitest'
import { StatelessClientStore } from './stateless-client-store.js'

describe('StatelessClientStore', () => {
  const SECRET = 'test-dcr-secret-for-testing'

  it('should register a client and return full metadata', () => {
    const store = new StatelessClientStore(SECRET)
    const result = store.registerClient({
      redirect_uris: ['http://localhost:3000/callback'],
      client_name: 'Test Client'
    } as any)

    expect(result.client_id).toBeTruthy()
    expect(result.client_secret).toBeTruthy()
    expect(result.client_id).toHaveLength(32)
    expect(result.client_id_issued_at).toBeGreaterThan(0)
    expect(result.redirect_uris).toEqual(['http://localhost:3000/callback'])
    expect(result.client_name).toBe('Test Client')
  })

  it('should produce deterministic client_id for same input', () => {
    const store = new StatelessClientStore(SECRET)
    const a = store.registerClient({
      redirect_uris: ['http://localhost:3000/callback'],
      client_name: 'Test Client'
    } as any)
    const b = store.registerClient({
      redirect_uris: ['http://localhost:3000/callback'],
      client_name: 'Test Client'
    } as any)

    expect(a.client_id).toBe(b.client_id)
    expect(a.client_secret).toBe(b.client_secret)
  })

  it('should produce different client_id for different redirect_uris', () => {
    const store = new StatelessClientStore(SECRET)
    const a = store.registerClient({
      redirect_uris: ['http://localhost:3000/callback'],
      client_name: 'Test'
    } as any)
    const b = store.registerClient({
      redirect_uris: ['http://localhost:4000/callback'],
      client_name: 'Test'
    } as any)

    expect(a.client_id).not.toBe(b.client_id)
  })

  it('should produce different client_id for different secrets', () => {
    const storeA = new StatelessClientStore('secret-a')
    const storeB = new StatelessClientStore('secret-b')

    const a = storeA.registerClient({ redirect_uris: ['http://localhost:3000/cb'] } as any)
    const b = storeB.registerClient({ redirect_uris: ['http://localhost:3000/cb'] } as any)

    expect(a.client_id).not.toBe(b.client_id)
  })

  it('should return cached client after registration', () => {
    const store = new StatelessClientStore(SECRET)
    const registered = store.registerClient({
      redirect_uris: ['http://localhost:3000/callback'],
      client_name: 'Cached Client'
    } as any)

    const retrieved = store.getClient(registered.client_id)
    expect(retrieved).toBeDefined()
    expect(retrieved!.client_id).toBe(registered.client_id)
    expect(retrieved!.client_secret).toBe(registered.client_secret)
    expect(retrieved!.redirect_uris).toEqual(['http://localhost:3000/callback'])
    expect(retrieved!.client_name).toBe('Cached Client')
  })

  it('should return fallback client for unknown client_id', () => {
    const store = new StatelessClientStore(SECRET)
    const retrieved = store.getClient('unknown-client-id')

    expect(retrieved).toBeDefined()
    expect(retrieved!.client_id).toBe('unknown-client-id')
    expect(retrieved!.client_secret).toBeTruthy()
    expect(retrieved!.redirect_uris).toEqual([])
  })

  it('should handle empty redirect_uris', () => {
    const store = new StatelessClientStore(SECRET)
    const result = store.registerClient({
      redirect_uris: [],
      client_name: 'No Redirect'
    } as any)

    expect(result.client_id).toBeTruthy()
    expect(result.redirect_uris).toEqual([])
  })

  it('should handle undefined client_name', () => {
    const store = new StatelessClientStore(SECRET)
    const result = store.registerClient({
      redirect_uris: ['http://localhost:3000/cb']
    } as any)

    expect(result.client_id).toBeTruthy()
  })
})
