import { describe, expect, it } from 'vitest'
import { RELAY_SCHEMA } from './relay-schema.js'

describe('RELAY_SCHEMA', () => {
  it('should have the correct server and displayName', () => {
    expect(RELAY_SCHEMA.server).toBe('better-email-mcp')
    expect(RELAY_SCHEMA.displayName).toBe('Email MCP')
  })

  it('should have the EMAIL_CREDENTIALS field with correct properties', () => {
    const emailCredentialsField = RELAY_SCHEMA.fields?.find((field: any) => field.key === 'EMAIL_CREDENTIALS')
    expect(emailCredentialsField).toBeDefined()
    expect(emailCredentialsField?.label).toBe('Email Credentials')
    expect(emailCredentialsField?.type).toBe('password')
    expect(emailCredentialsField?.placeholder).toBe('user@gmail.com:app-password')
    expect(emailCredentialsField?.helpText).toContain('Use App Passwords, not regular account passwords')
    expect(emailCredentialsField?.required).toBe(true)
  })
})
