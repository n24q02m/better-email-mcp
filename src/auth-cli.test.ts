import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runAuth } from './auth-cli.js'
import { deviceCodeAuth, isOutlookDomain } from './tools/helpers/oauth2.js'

vi.mock('./tools/helpers/oauth2.js', () => ({
  deviceCodeAuth: vi.fn(),
  isOutlookDomain: vi.fn()
}))

describe('runAuth', () => {
  const originalArgv = process.argv
  const originalExit = process.exit
  const originalConsoleError = console.error

  beforeEach(() => {
    // Reset process.argv
    process.argv = ['node', 'script.js', 'auth']
    // Mock process.exit
    process.exit = vi.fn((code) => {
      throw new Error(`process.exit called with ${code}`)
    }) as any
    // Mock console.error
    console.error = vi.fn()
  })

  afterEach(() => {
    // Restore originals
    process.argv = originalArgv
    process.exit = originalExit
    console.error = originalConsoleError
    vi.clearAllMocks()
  })

  it('should exit with 1 and print usage if no email is provided', async () => {
    await expect(runAuth()).rejects.toThrow('process.exit called with 1')

    expect(console.error).toHaveBeenCalledWith('Usage: better-email-mcp auth <email>')
    expect(console.error).toHaveBeenCalledWith('Example: better-email-mcp auth user@outlook.com')
    expect(console.error).toHaveBeenCalledWith('')
    expect(console.error).toHaveBeenCalledWith(
      'Authenticates an Outlook/Hotmail/Live account via OAuth2 Device Code flow.'
    )
    expect(console.error).toHaveBeenCalledWith('Tokens are saved to ~/.better-email-mcp/tokens.json')
    expect(process.exit).toHaveBeenCalledTimes(1)
    expect(process.exit).toHaveBeenCalledWith(1)
    expect(deviceCodeAuth).not.toHaveBeenCalled()
  })

  it('should exit with 1 and print error if email is not an Outlook domain', async () => {
    process.argv.push('user@gmail.com')
    vi.mocked(isOutlookDomain).mockReturnValue(false)

    await expect(runAuth()).rejects.toThrow('process.exit called with 1')

    expect(isOutlookDomain).toHaveBeenCalledWith('user@gmail.com')
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('OAuth2 auth is only needed for Outlook/Hotmail/Live accounts.')
    )
    expect(process.exit).toHaveBeenCalledTimes(1)
    expect(process.exit).toHaveBeenCalledWith(1)
    expect(deviceCodeAuth).not.toHaveBeenCalled()
  })

  it('should call deviceCodeAuth if email is a valid Outlook domain', async () => {
    process.argv.push('user@outlook.com')
    vi.mocked(isOutlookDomain).mockReturnValue(true)
    vi.mocked(deviceCodeAuth).mockResolvedValue({} as any)

    await runAuth()

    expect(isOutlookDomain).toHaveBeenCalledWith('user@outlook.com')
    expect(deviceCodeAuth).toHaveBeenCalledWith('user@outlook.com')
    expect(console.error).not.toHaveBeenCalled()
    expect(process.exit).not.toHaveBeenCalled()
  })

  it('should exit with 1 and print error if deviceCodeAuth throws', async () => {
    process.argv.push('user@outlook.com')
    vi.mocked(isOutlookDomain).mockReturnValue(true)
    vi.mocked(deviceCodeAuth).mockRejectedValue(new Error('Auth failed'))

    await expect(runAuth()).rejects.toThrow('process.exit called with 1')

    expect(deviceCodeAuth).toHaveBeenCalledWith('user@outlook.com')
    expect(console.error).toHaveBeenCalledWith('\nError: Auth failed')
    expect(process.exit).toHaveBeenCalledTimes(1)
    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it('should trim email input', async () => {
    process.argv.push('  user@outlook.com  ')
    vi.mocked(isOutlookDomain).mockReturnValue(true)
    vi.mocked(deviceCodeAuth).mockResolvedValue({} as any)

    await runAuth()

    expect(isOutlookDomain).toHaveBeenCalledWith('user@outlook.com')
    expect(deviceCodeAuth).toHaveBeenCalledWith('user@outlook.com')
  })

  it('should handle non-Error objects in catch block', async () => {
    process.argv.push('user@outlook.com')
    vi.mocked(isOutlookDomain).mockReturnValue(true)
    vi.mocked(deviceCodeAuth).mockRejectedValue('String error')

    await expect(runAuth()).rejects.toThrow('process.exit called with 1')

    expect(console.error).toHaveBeenCalledWith('\nError: String error')
    expect(process.exit).toHaveBeenCalledWith(1)
  })
})
