import { describe, expect, it, vi } from 'vitest'

const { loadStoredTokensMock } = vi.hoisted(() => ({
  loadStoredTokensMock: vi.fn()
}))

vi.mock('./oauth2.js', () => ({
  isOutlookDomain: (email: string) => email.toLowerCase().endsWith('@outlook.com'),
  loadStoredTokens: loadStoredTokensMock
}))

import { parseCredentials } from './config.js'

describe('Outlook OAuth2 configuration hydration', () => {
  it('attaches stored tokens to password-form Outlook credentials', async () => {
    const tokens = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: 9_999,
      clientId: 'client-id'
    }
    loadStoredTokensMock.mockResolvedValue(tokens)

    const result = await parseCredentials('user@outlook.com:ignored-password')

    expect(result[0]).toMatchObject({
      authType: 'oauth2',
      oauth2: tokens
    })
    expect(loadStoredTokensMock).toHaveBeenCalledWith('user@outlook.com')
  })
})
