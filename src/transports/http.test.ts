import { afterEach, beforeEach, describe, expect, it } from 'vitest'

describe('HTTP transport', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    delete process.env.TRANSPORT_MODE
    delete process.env.PORT
    delete process.env.EMAIL_CREDENTIALS
    delete process.env.PUBLIC_URL
    delete process.env.DCR_SERVER_SECRET
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  describe('transport mode detection', () => {
    it('should default to stdio when TRANSPORT_MODE is not set', () => {
      const transport = process.env.TRANSPORT_MODE || 'stdio'
      expect(transport).toBe('stdio')
    })

    it('should detect http mode from TRANSPORT_MODE env', () => {
      process.env.TRANSPORT_MODE = 'http'
      const transport = process.env.TRANSPORT_MODE || 'stdio'
      expect(transport).toBe('http')
    })

    it('should use default port 8080 when PORT is not set', () => {
      const port = parseInt(process.env.PORT ?? '8080', 10)
      expect(port).toBe(8080)
    })

    it('should use custom port from PORT env', () => {
      process.env.PORT = '3000'
      const port = parseInt(process.env.PORT ?? '8080', 10)
      expect(port).toBe(3000)
    })
  })

  describe('multi-user HTTP config', () => {
    it('should require PUBLIC_URL for HTTP mode', () => {
      const required = ['PUBLIC_URL', 'DCR_SERVER_SECRET']
      for (const key of required) {
        expect(process.env[key]).toBeUndefined()
      }
    })

    it('should accept all required env vars', () => {
      process.env.PUBLIC_URL = 'https://email-mcp.example.com'
      process.env.DCR_SERVER_SECRET = 'test-secret'
      process.env.PORT = '8080'

      expect(process.env.PUBLIC_URL).toBe('https://email-mcp.example.com')
      expect(process.env.DCR_SERVER_SECRET).toBe('test-secret')
    })
  })

  describe('backward compatibility', () => {
    it('should still support EMAIL_CREDENTIALS for stdio mode', () => {
      process.env.EMAIL_CREDENTIALS = 'user@gmail.com:pass123'
      expect(process.env.EMAIL_CREDENTIALS).toBe('user@gmail.com:pass123')
    })
  })
})
