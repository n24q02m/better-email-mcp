import { describe, expect, it } from 'vitest'
import { buildOutlookUpstream } from './outlook-device-code.js'

describe('buildOutlookUpstream', () => {
  it('constructs correct upstream config for Outlook device code', () => {
    const upstream = buildOutlookUpstream({ clientId: 'test-app' })
    expect(upstream.deviceAuthUrl).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/devicecode')
    expect(upstream.tokenUrl).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/token')
    expect(upstream.clientId).toBe('test-app')
    expect(upstream.scopes).toEqual([
      'offline_access',
      'https://outlook.office.com/IMAP.AccessAsUser.All',
      'https://outlook.office.com/SMTP.Send'
    ])
    expect(upstream.pollIntervalMs).toBe(5000)
  })
})
