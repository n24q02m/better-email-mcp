import { ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EmailMCPError } from './helpers/errors.js'
import { registerTools } from './registry.js'

// Mock the Server class
const mockSetRequestHandler = vi.fn()
const mockServer = {
  setRequestHandler: mockSetRequestHandler
} as any

// Mock dependencies
vi.mock('./composite/messages.js', () => ({ messages: vi.fn() }))
vi.mock('./composite/folders.js', () => ({ folders: vi.fn() }))
vi.mock('./composite/attachments.js', () => ({ attachments: vi.fn() }))
vi.mock('./composite/send.js', () => ({ send: vi.fn() }))
vi.mock('node:fs', () => ({
  readFileSync: vi.fn().mockReturnValue('mock content')
}))

describe('registry logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws EmailMCPError when resource is not found', async () => {
    // Register tools
    registerTools(mockServer, [])

    // Find the ReadResourceRequestSchema handler
    const handlerCall = mockSetRequestHandler.mock.calls.find((call) => call[0] === ReadResourceRequestSchema)

    expect(handlerCall).toBeDefined()
    const handler = handlerCall![1]

    // Simulate a request with an invalid URI
    const request = {
      params: {
        uri: 'email://docs/invalid-resource'
      }
    }

    await expect(handler(request)).rejects.toThrow(EmailMCPError)
    await expect(handler(request)).rejects.toThrow('Resource not found: email://docs/invalid-resource')
  })
})
