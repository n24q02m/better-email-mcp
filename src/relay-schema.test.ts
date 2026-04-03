import { describe, expect, it } from 'vitest'
import { RELAY_SCHEMA } from './relay-schema.js'

describe('RELAY_SCHEMA', () => {
  it('should have the correct server identifier', () => {
    expect(RELAY_SCHEMA.server).toBe('better-email-mcp')
  })

  it('should have the correct display name', () => {
    expect(RELAY_SCHEMA.displayName).toBe('Email MCP')
  })

  it('should have the required EMAIL_CREDENTIALS field', () => {
    expect(RELAY_SCHEMA.fields).toBeDefined()
    const field = RELAY_SCHEMA.fields?.find((f) => f.key === 'EMAIL_CREDENTIALS')
    expect(field).toBeDefined()
    expect(field?.label).toBe('Email Credentials')
    expect(field?.type).toBe('text')
    expect(field?.required).toBe(true)
  })

  it('should have helpful placeholder and helpText for EMAIL_CREDENTIALS', () => {
    const field = RELAY_SCHEMA.fields?.find((f) => f.key === 'EMAIL_CREDENTIALS')
    expect(field?.placeholder).toContain('user@gmail.com:app-password')
    expect(field?.helpText).toContain('Format: email:password')
  })
})
