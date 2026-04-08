import { execFile } from 'node:child_process'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { openBrowser } from './browser-utils.js'

vi.mock('node:child_process', () => ({
  execFile: vi.fn()
}))

describe('openBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls execFile with sanitized URL for http protocol', () => {
    const url = 'http://example.com'
    const expectedUrl = 'http://example.com/'
    openBrowser(url)

    if (process.platform === 'win32') {
      expect(execFile).toHaveBeenCalledWith(
        'rundll32',
        ['url.dll,FileProtocolHandler', expectedUrl],
        expect.any(Function)
      )
    } else {
      expect(execFile).toHaveBeenCalledWith(expect.any(String), [expectedUrl], expect.any(Function))
    }
  })

  it('calls execFile with sanitized URL for https protocol', () => {
    const url = 'https://example.com/path?query=1'
    openBrowser(url)

    if (process.platform === 'win32') {
      expect(execFile).toHaveBeenCalledWith('rundll32', ['url.dll,FileProtocolHandler', url], expect.any(Function))
    } else {
      expect(execFile).toHaveBeenCalledWith(expect.any(String), [url], expect.any(Function))
    }
  })

  it('canonicalizes URLs before passing to execFile', () => {
    const url = 'HTTPS://EXAMPLE.COM'
    const expectedUrl = 'https://example.com/'
    openBrowser(url)

    if (process.platform === 'win32') {
      expect(execFile).toHaveBeenCalledWith(
        'rundll32',
        ['url.dll,FileProtocolHandler', expectedUrl],
        expect.any(Function)
      )
    } else {
      expect(execFile).toHaveBeenCalledWith(expect.any(String), [expectedUrl], expect.any(Function))
    }
  })

  it('ignores non-http/https protocols', () => {
    const maliciousUrls = [
      'javascript:alert(1)',
      'data:text/html,hack',
      'file:///etc/passwd',
      'vbscript:msgbox',
      'mailto:test@example.com'
    ]

    for (const url of maliciousUrls) {
      openBrowser(url)
    }

    expect(execFile).not.toHaveBeenCalled()
  })

  it('handles shell metacharacters in URL query params safely', () => {
    const maliciousUrl = 'https://example.com/login?code=ABCD;echo"vulnerable"'
    const safeUrl = new URL(maliciousUrl).href

    openBrowser(maliciousUrl)

    if (process.platform === 'win32') {
      expect(execFile).toHaveBeenCalledWith('rundll32', ['url.dll,FileProtocolHandler', safeUrl], expect.any(Function))
    } else {
      expect(execFile).toHaveBeenCalledWith(expect.any(String), [safeUrl], expect.any(Function))
    }

    // execFile passes arguments as an array, so shell injection via ';' is prevented
    const args = (execFile as any).mock.calls[0][1] as string[]
    const finalArg = args[args.length - 1]
    expect(finalArg).toBe(safeUrl)
    expect(finalArg).toContain(';')
  })

  it('handles malformed URLs gracefully', () => {
    openBrowser('not-a-url')
    expect(execFile).not.toHaveBeenCalled()
  })
})
