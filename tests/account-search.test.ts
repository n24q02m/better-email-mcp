import { readFile } from 'node:fs/promises'
import { tryOpenBrowser } from '@n24q02m/mcp-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountConfig } from '../src/tools/helpers/config.js'
import * as oauth2 from '../src/tools/helpers/oauth2.js'

const { clients, imapFlow } = vi.hoisted(() => {
  const clients = new Map<string, Record<string, any>>()
  // biome-ignore lint/complexity/useArrowFunction: must use function keyword for the production `new ImapFlow(...)` contract.
  const imapFlow = vi.fn(function (options: { auth: { user: string } }) {
    const client = clients.get(options.auth.user)
    if (!client) throw new Error(`No IMAP fixture for ${options.auth.user}`)
    return client
  })

  return { clients, imapFlow }
})

vi.mock('imapflow', () => ({ ImapFlow: imapFlow }))
vi.mock('mailparser', () => ({ simpleParser: vi.fn().mockResolvedValue({ text: 'fixture body' }) }))
vi.mock('@n24q02m/mcp-core', () => ({ tryOpenBrowser: vi.fn().mockResolvedValue(true) }))
vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }))
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn()
}))
vi.mock('node:os', () => ({ homedir: vi.fn().mockReturnValue('/mock/home') }))

import { searchEmails } from '../src/tools/helpers/imap-client.js'

const mockEnsureValidToken = vi.spyOn(oauth2, 'ensureValidToken')
const mockReadFile = vi.mocked(readFile)
const mockTryOpenBrowser = vi.mocked(tryOpenBrowser)

const makeAccount = (id: string, email: string, oauthTokens: AccountConfig['oauth2']): AccountConfig => ({
  id,
  email,
  password: '',
  authType: 'oauth2',
  imap: { host: 'outlook.office365.com', port: 993, secure: true },
  smtp: { host: 'smtp.office365.com', port: 587, secure: false },
  ...(oauthTokens ? { oauth2: oauthTokens } : {})
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

const validTokens = (id: string): NonNullable<AccountConfig['oauth2']> => ({
  accessToken: `access-${id}`,
  refreshToken: `refresh-${id}`,
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  clientId: 'test-client-id'
})

beforeEach(() => {
  vi.clearAllMocks()
  clients.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('account-wide search OAuth behavior', () => {
  it('skips a missing-token account through production non-interactive auth while preserving another account', async () => {
    const available = makeAccount('available_outlook_com', 'available@outlook.com', validTokens('available'))
    const unavailable = makeAccount('auth_required_outlook_com', 'auth-required@outlook.com', undefined)
    addSearchFixture(available.email, 101)
    mockReadFile.mockRejectedValue({ code: 'ENOENT' })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

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
    expect(mockEnsureValidToken).toHaveBeenCalledWith(available, { allowInteractive: false })
    expect(mockEnsureValidToken).toHaveBeenCalledWith(unavailable, { allowInteractive: false })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mockTryOpenBrowser).not.toHaveBeenCalled()
  })

  it('skips an expired-token account after a real refresh failure while preserving another account', async () => {
    const available = makeAccount('available_outlook_com', 'available@outlook.com', validTokens('available'))
    const unavailable = makeAccount('refresh_failed_outlook_com', 'refresh-failed@outlook.com', {
      accessToken: 'expired-token',
      refreshToken: 'expired-refresh-token',
      expiresAt: Math.floor(Date.now() / 1000) - 100,
      clientId: 'test-client-id'
    })
    addSearchFixture(available.email, 202)
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ error: 'invalid_grant', error_description: 'Refresh token expired' })
    })
    vi.stubGlobal('fetch', fetchMock)

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
    expect(mockEnsureValidToken).toHaveBeenCalledWith(available, { allowInteractive: false })
    expect(mockEnsureValidToken).toHaveBeenCalledWith(unavailable, { allowInteractive: false })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/oauth2/v2.0/token')
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain('/devicecode')
    expect(mockTryOpenBrowser).not.toHaveBeenCalled()
  })
})
