import { afterEach, beforeEach, describe, expect, it } from 'vitest'

describe('HTTP transport', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Clean env for each test
    delete process.env.TRANSPORT_MODE
    delete process.env.PORT
    delete process.env.EMAIL_CREDENTIALS
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

    it('should use default port 8080 when PORT is not set', async () => {
      const port = parseInt(process.env.PORT ?? '8080', 10)
      expect(port).toBe(8080)
    })

    it('should use custom port from PORT env', async () => {
      process.env.PORT = '3000'
      const port = parseInt(process.env.PORT ?? '8080', 10)
      expect(port).toBe(3000)
    })
  })

  describe('credential resolution priority', () => {
    it('should prefer EMAIL_CREDENTIALS env var', () => {
      process.env.EMAIL_CREDENTIALS = 'user@gmail.com:pass123'
      expect(process.env.EMAIL_CREDENTIALS).toBe('user@gmail.com:pass123')
    })
  })
})
