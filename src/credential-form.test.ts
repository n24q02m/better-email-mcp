import { renderCredentialForm } from '@n24q02m/mcp-core'
import { describe, expect, it } from 'vitest'

import { RELAY_SCHEMA } from './relay-schema.js'

/**
 * The forked `renderEmailCredentialForm` was dropped in favour of mcp-core's
 * shared `renderCredentialForm` driven by the `cardGroup` schema (RELAY_SCHEMA).
 * These tests pin the served-form contract that the de-fork must preserve:
 * same field set, Add/Remove card controls, and an `accounts`-array submit.
 */
describe('email credential form (core card-group renderer)', () => {
  const render = (submitUrl: string) => renderCredentialForm(RELAY_SCHEMA, { submitUrl })

  it('returns a complete HTML document titled with the display name', () => {
    const html = render('/authorize?nonce=abc')
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Email MCP')
  })

  it('renders the repeatable card group with an Add-account control', () => {
    const html = render('/auth')
    expect(html).toContain('card-group-container')
    expect(html).toContain('card-group-add')
    expect(html).toContain('Add Another Account')
  })

  it('exposes Remove-card controls for the multi-account contract', () => {
    const html = render('/auth')
    expect(html).toContain('card-group-remove')
  })

  it('carries every account field (email, password, IMAP host + port)', () => {
    const html = render('/auth')
    expect(html).toContain('"email"')
    expect(html).toContain('"password"')
    expect(html).toContain('"imap_host"')
    expect(html).toContain('"imap_port"')
  })

  it('titles each card by the email field', () => {
    const html = render('/auth')
    // titleField is threaded into the card-group script as TITLE_FIELD.
    expect(html).toMatch(/TITLE_FIELD\s*=\s*"email"/)
  })

  it('submits accounts as a JSON array under the group key', () => {
    const html = render('/auth')
    expect(html).toMatch(/GROUP_KEY\s*=\s*"accounts"/)
    expect(html).toContain('payload[GROUP_KEY] = items')
  })

  it('POSTs to the provided submitUrl', () => {
    const html = render('/authorize?nonce=xyz')
    expect(html).toContain('/authorize?nonce=xyz')
  })

  it('retains the Outlook device-code follow-up (poll for s.outlook complete)', () => {
    const html = render('/auth')
    expect(html).toContain('oauth_device_code')
    expect(html).toMatch(/s\.outlook\s*===\s*"complete"/)
    expect(html).toContain('/setup-status')
  })

  it('mentions Outlook OAuth handling + App Password guidance in the schema copy', () => {
    const html = render('/auth')
    expect(html).toMatch(/Outlook[^<]*OAuth2/i)
    expect(html).toMatch(/App Password/i)
  })
})
