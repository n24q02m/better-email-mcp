import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountConfig } from '../src/tools/helpers/config.js'

const { clients, deviceCodeAuth, ensureValidToken, imapFlow } = vi.hoisted(() => {
  const clients = new Map<string, Record<string, any>>()
  const deviceCodeAuth = vi.fn()
  const ensureValidToken = vi.fn()
  // biome-ignore lint/complexity/useArrowFunction: must use function keyword for the production `new ImapFlow(...)` contract.
  const imapFlow = vi.fn(function (options: { auth: { user: string } }) {
    const client = clients.get(options.auth.user)
    if (!client) throw new Error(`No IMAP fixture for ${options.auth.user}`)
    return client
  })

  return { clients, deviceCodeAuth, ensureValidToken, imapFlow }
})

vi.mock('imapflow', () => ({ ImapFlow: imapFlow }))
vi.mock('mailparser', () => ({ simpleParser: vi.fn().mockResolvedValue({ text: 'fixture body' }) }))
vi.mock('../src/tools/helpers/oauth2.js', () => ({
  deviceCodeAuth,
  ensureValidToken
}))

import { searchEmails } from '../src/tools/helpers/imap-client.js'

const makeAccount = (id: string, email: string): AccountConfig => ({
  id,
  email,
  password: '',
  authType: 'oauth2',
  imap: { host: 'outlook.office365.com', port: 993, secure: true },
  smtp: { host: 'smtp.office365.com', port: 587, secure: false },
  oauth2: {
    accessToken: `access-${id}`,
    refreshToken: `refresh-${id}`,
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    clientId: 'test-client-id'
  }
})

function addSearchFixture(email: string, uid: number): void {
  clients.set(email, {
    connect: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    getMailboxLock: vi.fn().mockResolvedValue({ release: vi.fn() }),
    capabilities: new Map<string, boolean | number>(),
    enabled: new Set<string>(),
    mailbox: { uidNext: uid + 1 },
    search: vi.fn().mockResolvedValue([uid]),
    fetchAll: vi.fn().mockResolvedValue([
      {
        uid,
        flags: new Set<string>(),
        envelope: {
          messageId: `<${uid}@example.test>`,
          subject: `Message ${uid}`,
          from: [{ address: 'sender@example.test' }],
          to: [{ address: email }],
          date: new Date('2026-08-09T00:00:00.000Z')
        },
        source: Buffer.from('fixture body')
      }
    ])
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  clients.clear()
})

describe('account-wide search OAuth behavior', () => {
  it('skips only an account requiring OAuth while preserving other account results', async () => {
    const available = makeAccount('available_outlook_com', 'available@outlook.com')
    const unavailable = makeAccount('auth_required_outlook_com', 'auth-required@outlook.com')
    addSearchFixture(available.email, 101)

    ensureValidToken.mockImplementation(async (account: AccountConfig) => {
      if (account.id === unavailable.id) {
        throw Object.assign(new Error('interactive sign-in must not start'), { code: 'OAUTH_AUTH_REQUIRED' })
      }
      return account.oauth2?.accessToken
    })

    const results = await searchEmails([available, unavailable], 'ALL', 'INBOX', 10)

    expect(results.map((result) => result.account_id)).toEqual([available.id])
    expect(results.unavailableAccounts).toEqual([
      {
        account_id: unavailable.id,
        account_email: unavailable.email,
        code: 'OAUTH_AUTH_REQUIRED',
        reason: 'OAuth authentication required for this account.'
      }
    ])
    expect(ensureValidToken).toHaveBeenCalledWith(available, { allowInteractive: false })
    expect(ensureValidToken).toHaveBeenCalledWith(unavailable, { allowInteractive: false })
    expect(deviceCodeAuth).not.toHaveBeenCalled()
  })

  it('skips only an account whose OAuth refresh failed while preserving other account results', async () => {
    const available = makeAccount('available_outlook_com', 'available@outlook.com')
    const unavailable = makeAccount('refresh_failed_outlook_com', 'refresh-failed@outlook.com')
    addSearchFixture(available.email, 202)

    ensureValidToken.mockImplementation(async (account: AccountConfig) => {
      if (account.id === unavailable.id) {
        throw Object.assign(new Error('refresh failure must not start interactive auth'), {
          code: 'OAUTH_REFRESH_FAILED'
        })
      }
      return account.oauth2?.accessToken
    })

    const results = await searchEmails([available, unavailable], 'ALL', 'INBOX', 10)

    expect(results.map((result) => result.account_id)).toEqual([available.id])
    expect(results.unavailableAccounts).toEqual([
      {
        account_id: unavailable.id,
        account_email: unavailable.email,
        code: 'OAUTH_REFRESH_FAILED',
        reason: 'OAuth token refresh failed for this account.'
      }
    ])
    expect(deviceCodeAuth).not.toHaveBeenCalled()
  })
})
