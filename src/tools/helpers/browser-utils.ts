/**
 * Browser utilities for opening URLs safely.
 */

import { execFile } from 'node:child_process'

/**
 * Open a URL in the user's default browser safely.
 * Uses execFile with argument arrays to prevent command injection.
 * Filters for http/https protocols only.
 */
export function openBrowser(url: string): void {
  let safeUrl: string
  try {
    const parsed = new URL(url)
    // Security: Only allow web protocols to prevent javascript: or file: attacks
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return
    }
    // URL.href canonicalizes the string, neutering leading hyphens or shell metacharacters
    safeUrl = parsed.href
  } catch {
    return
  }

  // Security: Use execFile to bypass the shell and pass arguments directly
  if (process.platform === 'darwin') {
    execFile('open', [safeUrl], () => {})
  } else if (process.platform === 'win32') {
    // On Windows, use rundll32 to open URLs safely without cmd.exe shell interpretation
    execFile('rundll32', ['url.dll,FileProtocolHandler', safeUrl], () => {})
  } else {
    execFile('xdg-open', [safeUrl], () => {})
  }
}
