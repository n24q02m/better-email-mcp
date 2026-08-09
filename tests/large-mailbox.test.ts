import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountConfig } from '../src/tools/helpers/config.js'

const {
  fakeMailbox,
  messageCount,
  limit,
  firstReturnedUid,
  boundedWindowSearch,
  buildFixtureMessages,
  defaultFetchAll
} = vi.hoisted(() => {
  const messageCount = 10_001
  const limit = 20
  const firstReturnedUid = messageCount - limit + 1

  const boundedWindowSearch = async (criteria: { uid?: unknown }, options: { uid?: boolean } | undefined) => {
    if (options?.uid !== true || typeof criteria.uid !== 'string' || criteria.uid.includes(',')) {
      throw new Error(`search must use a bounded UID window instead of materializing ${messageCount} UIDs`)
    }

    const [low, high] = criteria.uid.split(':').map(Number)
    if (!Number.isInteger(low) || !Number.isInteger(high) || high - low + 1 > 500) {
      throw new Error(`search window must be at most 500 UIDs, got ${criteria.uid}`)
    }

    return Array.from(
      { length: Math.max(0, Math.min(high, messageCount) - Math.max(low, firstReturnedUid) + 1) },
      (_, index) => Math.max(low, firstReturnedUid) + index
    )
  }

  const buildFixtureMessages = () =>
    Array.from({ length: limit }, (_, index) => ({
      uid: firstReturnedUid + index,
      flags: new Set<string>(),
      envelope: {
        messageId: `<fixture-${firstReturnedUid + index}@example.test>`,
        subject: `Fixture ${firstReturnedUid + index}`,
        from: [{ address: 'sender@example.test' }],
        to: [{ address: 'recipient@example.test' }],
        date: new Date('2026-08-09T00:00:00.000Z')
      },
      source: Buffer.from('fixture')
    }))

  const defaultFetchAll = async (range: number[] | string) => {
    const expectedUids = Array.from({ length: limit }, (_, index) => firstReturnedUid + index)
    if (!Array.isArray(range) || range.join(',') !== expectedUids.join(',')) {
      throw new Error(`expected bounded UID list ${expectedUids.join(',')}, got ${String(range)}`)
    }

    return buildFixtureMessages()
  }

  const fakeMailbox = {
    connect: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    getMailboxLock: vi.fn().mockResolvedValue({ release: vi.fn() }),
    capabilities: new Map<string, boolean | number>(),
    enabled: new Set<string>(),
    mailbox: { uidNext: messageCount + 1 },
    search: vi.fn(boundedWindowSearch),
    fetchAll: vi.fn(defaultFetchAll)
  }

  return {
    fakeMailbox,
    messageCount,
    limit,
    firstReturnedUid,
    boundedWindowSearch,
    buildFixtureMessages,
    defaultFetchAll
  }
})

vi.mock('imapflow', () => ({
  // biome-ignore lint/complexity/useArrowFunction: must use function keyword for `new` constructor mock
  ImapFlow: vi.fn(function () {
    return fakeMailbox
  })
}))

vi.mock('mailparser', () => ({
  simpleParser: vi.fn().mockResolvedValue({ text: 'fixture' })
}))

vi.mock('../src/tools/helpers/oauth2.js', () => ({
  ensureValidToken: vi.fn().mockResolvedValue('fixture-access-token')
}))

import { searchEmails } from '../src/tools/helpers/imap-client.js'

const account: AccountConfig = {
  id: 'large_mailbox_example_test',
  email: 'large-mailbox@example.test',
  password: 'not-a-secret',
  imap: { host: 'imap.example.test', port: 993, secure: true },
  smtp: { host: 'smtp.example.test', port: 465, secure: true }
}

beforeEach(() => {
  vi.clearAllMocks()
  fakeMailbox.connect.mockResolvedValue(undefined)
  fakeMailbox.logout.mockResolvedValue(undefined)
  fakeMailbox.getMailboxLock.mockResolvedValue({ release: vi.fn() })
  fakeMailbox.capabilities = new Map()
  fakeMailbox.enabled = new Set()
  fakeMailbox.mailbox.uidNext = messageCount + 1
  fakeMailbox.search = vi.fn(boundedWindowSearch)
  fakeMailbox.fetchAll = vi.fn(defaultFetchAll)
})

describe('searchEmails large mailbox', () => {
  it('returns the newest limited page without materializing 10,001 matching UIDs', async () => {
    const results = await searchEmails([account], 'ALL', 'INBOX', 20)

    expect(results).toHaveLength(20)
    expect(results.map((result) => result.uid)).toEqual([
      9982, 9983, 9984, 9985, 9986, 9987, 9988, 9989, 9990, 9991, 9992, 9993, 9994, 9995, 9996, 9997, 9998, 9999,
      10_000, 10_001
    ])
    expect(fakeMailbox.search).toHaveBeenCalledTimes(1)
    expect(fakeMailbox.search).toHaveBeenCalledWith({ uid: '9502:10001' }, { uid: true })
    expect(fakeMailbox.fetchAll).toHaveBeenCalledWith(
      Array.from({ length: limit }, (_, index) => firstReturnedUid + index),
      expect.any(Object),
      { uid: true }
    )
  })

  it('returns fetched messages in UID order when fetchAll returns them shuffled', async () => {
    const expectedUids = Array.from({ length: limit }, (_, index) => firstReturnedUid + index)
    const messages = buildFixtureMessages()
    const shuffledMessages = messages
      .filter((_, index) => index % 2 === 1)
      .concat(messages.filter((_, index) => index % 2 === 0))

    fakeMailbox.fetchAll = vi.fn(async (range: number[] | string) => {
      if (!Array.isArray(range) || range.join(',') !== expectedUids.join(',')) {
        throw new Error(`expected bounded UID range ${expectedUids.join(',')}, got ${String(range)}`)
      }

      return shuffledMessages
    })

    const results = await searchEmails([account], 'ALL', 'INBOX', limit)

    expect(results.map((result) => result.uid)).toEqual(expectedUids)
  })

  it('uses ESEARCH RETURN (PARTIAL) as a single round trip when the server advertises ESEARCH', async () => {
    const selectedRange = `${firstReturnedUid}:${messageCount}`
    fakeMailbox.capabilities.set('ESEARCH', true)
    fakeMailbox.search = vi.fn(
      async (
        _criteria: unknown,
        options: { uid?: boolean; returnOptions?: Array<{ partial?: string }> } | undefined
      ) => {
        const partialOption = options?.returnOptions?.[0]?.partial
        if (!options?.uid || partialOption !== `-${limit}:-1`) {
          throw new Error(`expected UID SEARCH RETURN (PARTIAL -${limit}:-1), got ${JSON.stringify(options)}`)
        }
        return { partial: { range: `-${limit}:-1`, messages: selectedRange } }
      }
    )
    fakeMailbox.fetchAll = vi.fn(async (range: number[] | string) => {
      if (range !== selectedRange) {
        throw new Error(`expected bounded UID range ${selectedRange}, got ${String(range)}`)
      }

      return buildFixtureMessages()
    })

    const results = await searchEmails([account], 'ALL', 'INBOX', limit)

    expect(results).toHaveLength(limit)
    expect(results.map((result) => result.uid)).toEqual(
      Array.from({ length: limit }, (_, index) => firstReturnedUid + index)
    )
    expect(fakeMailbox.search).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['a valid UID array', Array.from({ length: limit }, (_, index) => firstReturnedUid + index)],
    ['a valid empty UID array', []]
  ] as const)('accepts %s from ESEARCH without bounded fallback', async (_label, partialMessages) => {
    fakeMailbox.capabilities.set('ESEARCH', true)
    fakeMailbox.search = vi.fn(async () => ({ partial: { range: `-${limit}:-1`, messages: partialMessages } }))

    const results = await searchEmails([account], 'ALL', 'INBOX', limit)

    expect(results).toHaveLength(partialMessages.length)
    expect(fakeMailbox.search).toHaveBeenCalledTimes(1)
    if (partialMessages.length === 0) {
      expect(fakeMailbox.fetchAll).not.toHaveBeenCalled()
    }
  })

  it.each([
    ['an oversized UID range', `${firstReturnedUid - 1}:${messageCount}`],
    ['a UID range below the mailbox bounds', `0:1`],
    ['a UID range above the newest mailbox UID', `${firstReturnedUid}:${messageCount + 1}`],
    ['a UID range with duplicate values', `${firstReturnedUid},${firstReturnedUid}`],
    ['an oversized UID array', Array.from({ length: limit + 1 }, (_, index) => messageCount - limit + index)],
    ['a UID array above the newest mailbox UID', [messageCount + 1]],
    ['a UID array with duplicate values', [firstReturnedUid, firstReturnedUid]]
  ] as const)('falls back to bounded UID-window searches when ESEARCH returns %s', async (_label, partialMessages) => {
    fakeMailbox.capabilities.set('ESEARCH', true)
    fakeMailbox.search = vi.fn(
      async (criteria: { uid?: unknown }, options: { uid?: boolean; returnOptions?: unknown[] } | undefined) => {
        if (options?.returnOptions) {
          return { partial: { range: `-${limit}:-1`, messages: partialMessages } }
        }

        return boundedWindowSearch(criteria, options)
      }
    )

    const results = await searchEmails([account], 'ALL', 'INBOX', limit)

    expect(results).toHaveLength(limit)
    expect(results.map((result) => result.uid)).toEqual(
      Array.from({ length: limit }, (_, index) => firstReturnedUid + index)
    )
    expect(fakeMailbox.search).toHaveBeenCalledTimes(2)
  })

  it('continues through multiple bounded UID windows when each window has sparse matches', async () => {
    const windowMatches: Record<string, number[]> = {
      '9502:10001': [9999, 10001],
      '9002:9501': [9002, 9300, 9501],
      '8502:9001': Array.from({ length: 15 }, (_, index) => 8502 + index)
    }
    const expectedUids = [
      ...windowMatches['8502:9001']!,
      ...windowMatches['9002:9501']!,
      ...windowMatches['9502:10001']!
    ]

    fakeMailbox.search = vi.fn(async (criteria: { uid?: unknown }, options: { uid?: boolean } | undefined) => {
      if (options?.uid !== true || typeof criteria.uid !== 'string') {
        throw new Error(`expected bounded UID search, got ${JSON.stringify({ criteria, options })}`)
      }

      const matches = windowMatches[criteria.uid]
      if (!matches) throw new Error(`unexpected UID window ${criteria.uid}`)
      return matches
    })
    fakeMailbox.fetchAll = vi.fn(async (range: number[] | string) => {
      if (!Array.isArray(range) || range.join(',') !== expectedUids.join(',')) {
        throw new Error(`expected sparse-match UIDs ${expectedUids.join(',')}, got ${String(range)}`)
      }

      return buildFixtureMessages().map((message, index) => ({ ...message, uid: expectedUids[index]! }))
    })

    const results = await searchEmails([account], 'ALL', 'INBOX', limit)

    expect(results.map((result) => result.uid)).toEqual(expectedUids)
    expect(fakeMailbox.search).toHaveBeenCalledTimes(3)
    expect(fakeMailbox.search.mock.calls.map(([criteria]) => (criteria as { uid: string }).uid)).toEqual([
      '9502:10001',
      '9002:9501',
      '8502:9001'
    ])
  })

  it.each([
    ['zero', [0]],
    ['NaN', [Number.NaN]],
    ['a negative value', [-1]],
    ['a non-integer', [1.5]],
    ['a safe-integer overflow', [Number.MAX_SAFE_INTEGER + 1]],
    ['a duplicate UID', [firstReturnedUid, firstReturnedUid]],
    ['a UID below the requested window', [firstReturnedUid - 1]],
    ['a UID above the newest mailbox UID', [messageCount + 1]]
  ] as const)('rejects %s from a bounded UID SEARCH response', async (_label, invalidUids) => {
    fakeMailbox.search = vi.fn(async () => invalidUids)

    const results = await searchEmails([account], 'ALL', 'INBOX', limit)

    expect(results).toHaveLength(0)
    expect(results.unavailableAccounts).toEqual([
      expect.objectContaining({
        code: 'IMAP_SEARCH_FAILED',
        reason: expect.stringContaining('invalid UIDs')
      })
    ])
    expect(fakeMailbox.fetchAll).not.toHaveBeenCalled()
  })

  it('keeps valid fallback matches within the requested limit', async () => {
    const allMatches = Array.from({ length: 500 }, (_, index) => 9502 + index)
    fakeMailbox.search = vi.fn(async () => allMatches)
    fakeMailbox.fetchAll = vi.fn(async (range: number[] | string) => {
      expect(range).toEqual(allMatches.slice(-limit))
      return buildFixtureMessages()
    })

    const results = await searchEmails([account], 'ALL', 'INBOX', limit)

    expect(results).toHaveLength(limit)
    expect(results.map((result) => result.uid)).toEqual(
      Array.from({ length: limit }, (_, index) => firstReturnedUid + index)
    )
  })

  it.each([
    ['resolves false', false],
    ['resolves an ESEARCH result with no partial field', {}],
    ['returns a non-array partial messages value', { partial: { range: `-${limit}:-1`, messages: 'invalid' } }],
    ['returns partial messages with an invalid UID', { partial: { range: `-${limit}:-1`, messages: [0] } }]
  ])(
    'falls back to bounded UID-window searches when ESEARCH %s instead of silently returning no results',
    async (_label, esearchReply) => {
      fakeMailbox.capabilities.set('ESEARCH', true)
      fakeMailbox.search = vi.fn(
        async (criteria: { uid?: unknown }, options: { uid?: boolean; returnOptions?: unknown[] } | undefined) => {
          if (options?.returnOptions) return esearchReply
          return boundedWindowSearch(criteria, options)
        }
      )

      const results = await searchEmails([account], 'ALL', 'INBOX', limit)

      expect(results).toHaveLength(limit)
      expect(results.map((result) => result.uid)).toEqual(
        Array.from({ length: limit }, (_, index) => firstReturnedUid + index)
      )

      const calls = fakeMailbox.search.mock.calls as Array<[unknown, { returnOptions?: unknown[] } | undefined]>
      expect(calls.length).toBeGreaterThanOrEqual(2)
      expect(calls[0]?.[1]?.returnOptions).toBeDefined()
      expect(calls.slice(1).every(([, options]) => options?.returnOptions === undefined)).toBe(true)
    }
  )
})
