import { describe, expect, it } from 'vitest'
import { RELAY_SCHEMA } from './relay-schema.js'

describe('RELAY_SCHEMA', () => {
  it('has the correct server identifier', () => {
    expect(RELAY_SCHEMA.server).toBe('better-email-mcp')
  })

  it('has the correct display name', () => {
    expect(RELAY_SCHEMA.displayName).toBe('Email MCP')
  })

  it('defines the required EMAIL_CREDENTIALS field', () => {
    expect(RELAY_SCHEMA.fields).toHaveLength(1)
    const field = RELAY_SCHEMA.fields![0]
    expect(field.key).toBe('EMAIL_CREDENTIALS')
    expect(field.label).toBe('Email Credentials')
    expect(field.type).toBe('text')
    expect(field.required).toBe(true)
    expect(field.placeholder).toBe('user@gmail.com:app-password')
    expect(field.helpText).toContain('Format: email:password')
  })
})
