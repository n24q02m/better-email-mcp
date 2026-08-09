import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountConfig } from '../src/tools/helpers/config.js'

const { fakeMailbox } = vi.hoisted(() => {
  const messageCount = 10_001
  const limit = 20
  const firstReturnedUid = messageCount - limit + 1
  const selectedRange = `${firstReturnedUid}:${messageCount}`

  const fakeMailbox = {
    connect: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    getMailboxLock: vi.fn().mockResolvedValue({ release: vi.fn() }),
    search: vi.fn(async (_criteria: unknown, options: { returnOptions?: unknown[] } | undefined) => {
      const partial = options?.returnOptions?.[0]
      if (!partial || typeof partial !== 'object' || !('partial' in partial) || partial.partial !== `-${limit}:-1`) {
        throw new Error(`legacy UID SEARCH would materialize ${messageCount} UIDs`)
      }

      return { partial: { range: `-${limit}:-1`, messages: selectedRange } }
    }),
    fetchAll: vi.fn(async (range: string) => {
      if (range !== selectedRange) {
        throw new Error(`expected bounded UID range ${selectedRange}, got ${range}`)
      }

      return Array.from({ length: limit }, (_, index) => ({
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
    })
  }

  return { fakeMailbox }
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
})

describe('searchEmails large mailbox', () => {
  it('returns the newest limited page without materializing 10,001 matching UIDs', async () => {
    const results = await searchEmails([account], 'ALL', 'INBOX', 20)

    expect(results).toHaveLength(20)
    expect(results.map((result) => result.uid)).toEqual([
      9982, 9983, 9984, 9985, 9986, 9987, 9988, 9989, 9990, 9991, 9992, 9993, 9994, 9995, 9996, 9997, 9998, 9999,
      10_000, 10_001
    ])
  })
})
