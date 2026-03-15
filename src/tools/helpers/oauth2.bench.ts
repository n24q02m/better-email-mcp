import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { afterAll, beforeAll, bench, describe } from 'vitest'
import { loadStoredTokens } from './oauth2.js'

describe('oauth2 token loading', () => {
  const email = 'test@outlook.com'
  const configDir = `${process.env.HOME}/.better-email-mcp`
  const tokenFile = `${configDir}/tokens.json`

  beforeAll(() => {
    try {
      mkdirSync(configDir, { recursive: true })
    } catch {}
    writeFileSync(
      tokenFile,
      JSON.stringify({
        'test@outlook.com': { accessToken: '123', refreshToken: '456', expiresAt: 0, clientId: '789' }
      })
    )
  })

  afterAll(() => {
    try {
      unlinkSync(tokenFile)
    } catch {}
  })

  bench('loadStoredTokens - synchronous', () => {
    loadStoredTokens(email)
  })
})
