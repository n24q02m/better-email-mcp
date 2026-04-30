import { beforeEach, describe, expect, test } from 'vitest'
import { InMemoryCredStore } from './in-memory-cred-store.js'

describe('InMemoryCredStore', () => {
  let store: InMemoryCredStore

  beforeEach(() => {
    store = new InMemoryCredStore()
  })

  test('save and load round-trip', async () => {
    await store.save('sub-a', { token: 'tok-a' })
    expect(await store.load('sub-a')).toEqual({ token: 'tok-a' })
  })

  test('per-sub isolation', async () => {
    await store.save('sub-a', { token: 'tok-a' })
    await store.save('sub-b', { token: 'tok-b' })
    expect(await store.load('sub-a')).toEqual({ token: 'tok-a' })
    expect(await store.load('sub-b')).toEqual({ token: 'tok-b' })
  })

  test('credentials lost on restart (in-memory only)', async () => {
    const store1 = new InMemoryCredStore()
    await store1.save('sub-a', { token: 'tok' })
    expect(await store1.load('sub-a')).toEqual({ token: 'tok' })

    const store2 = new InMemoryCredStore() // simulate restart
    expect(await store2.load('sub-a')).toBeNull()
  })

  test('clear specific sub', async () => {
    await store.save('sub-a', { token: 'tok-a' })
    await store.save('sub-b', { token: 'tok-b' })
    await store.clear('sub-a')
    expect(await store.load('sub-a')).toBeNull()
    expect(await store.load('sub-b')).toEqual({ token: 'tok-b' })
  })

  test('list subs returns all known', async () => {
    await store.save('sub-a', { x: 1 })
    await store.save('sub-b', { x: 2 })
    const subs = await store.listSubs()
    expect(new Set(subs)).toEqual(new Set(['sub-a', 'sub-b']))
  })
})
