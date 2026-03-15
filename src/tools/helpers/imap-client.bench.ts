import { bench, describe, vi } from 'vitest'

const { mockConnect, mockLogout, mockList } = vi.hoisted(() => {
  return {
    mockConnect: vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 50))
    }),
    mockLogout: vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10))
    }),
    mockList: vi.fn().mockResolvedValue([{ name: 'INBOX', path: 'INBOX', flags: [], delimiter: '/' }])
  }
})

vi.mock('imapflow', () => {
  return {
    ImapFlow: vi.fn(() => ({
      connect: mockConnect,
      logout: mockLogout,
      getMailboxLock: vi.fn().mockResolvedValue({ release: vi.fn() }),
      list: mockList,
      on: vi.fn(),
      usable: true
    }))
  }
})

import { listFolders } from './imap-client.js'

describe('IMAP Client Pooling', () => {
  const account = {
    id: 'test',
    email: 'test@example.com',
    password: 'pass',
    imap: { host: 'imap.example.com', port: 993, secure: true },
    smtp: { host: 'smtp.example.com', port: 465, secure: true }
  }

  bench(
    'execute 10 consecutive operations',
    async () => {
      for (let i = 0; i < 10; i++) {
        await listFolders(account)
      }
    },
    { time: 5000, iterations: 5 }
  )
})
