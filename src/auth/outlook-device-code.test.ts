import { afterEach, describe, expect, it } from 'vitest'
import { buildOutlookUpstream } from './outlook-device-code.js'

describe('buildOutlookUpstream', () => {
  afterEach(() => {
    delete process.env.OUTLOOK_TENANT
    delete process.env.OUTLOOK_SCOPES
  })

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

  it('honors OUTLOOK_TENANT on both endpoints', () => {
    process.env.OUTLOOK_TENANT = '72f988bf-86f1-41af-91ab-2d7cd011db47'
    const upstream = buildOutlookUpstream({ clientId: 'test-app' })
    expect(upstream.deviceAuthUrl).toBe(
      'https://login.microsoftonline.com/72f988bf-86f1-41af-91ab-2d7cd011db47/oauth2/v2.0/devicecode'
    )
    expect(upstream.tokenUrl).toBe(
      'https://login.microsoftonline.com/72f988bf-86f1-41af-91ab-2d7cd011db47/oauth2/v2.0/token'
    )
  })

  it('honors OUTLOOK_SCOPES', () => {
    process.env.OUTLOOK_SCOPES = 'offline_access https://outlook.office.com/IMAP.AccessAsUser.All'
    const upstream = buildOutlookUpstream({ clientId: 'test-app' })
    expect(upstream.scopes).toEqual(['offline_access', 'https://outlook.office.com/IMAP.AccessAsUser.All'])
  })
})
