/**
 * Relay config helper for better-email-mcp.
 *
 * The live credential path is in `credential-state.ts` (stdio fallback
 * spawns a LOCAL `runLocalServer`; HTTP modes mount via `transports/http.ts`).
 * This module only exposes `formatCredentials`, shared by both the config
 * loader and the local-spawn onCredentialsSaved callback.
 */

/**
 * Format relay config into EMAIL_CREDENTIALS string.
 *
 * Supports two formats from the relay page:
 * - New (multi-account): { EMAIL_CREDENTIALS: "email1:pass1,email2:pass2" }
 * - Legacy (single account): { email, password, imap_host? }
 */
export function formatCredentials(config: Record<string, string>): string {
  // New format: relay page sends EMAIL_CREDENTIALS directly
  if (config.EMAIL_CREDENTIALS) {
    return config.EMAIL_CREDENTIALS
  }

  // Legacy format: individual fields from old relay page
  const { email, password, imap_host } = config
  if (!email || !password) {
    throw new Error('Relay config missing required fields: EMAIL_CREDENTIALS or email+password')
  }
  if (imap_host) {
    return `${email}:${password}:${imap_host}`
  }
  return `${email}:${password}`
}
