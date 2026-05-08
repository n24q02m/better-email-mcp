/**
 * Per-request subject scope for better-email-mcp remote-relay mode.
 *
 * The HTTP transport wraps each verified /mcp request in this AsyncLocalStorage
 * so tool handlers can look up the caller's own mailbox list without ever
 * touching process-global env vars. The ``sub`` is the JWT ``sub`` claim
 * issued by the local OAuth AS (see ``mcp-core`` SubjectContext), and
 * ``accounts`` is the list resolved from the encrypted per-user credential
 * store (``per-user-credential-store.ts``).
 *
 * Local-relay + stdio do NOT use this — they're explicitly single-user and
 * read from the credential state / the closure resolved at
 * server startup. The module still exports ``subjectContext`` unconditionally
 * so the serverFactory can safely call ``getStore()`` in any mode (returns
 * ``undefined`` outside an active scope ⇒ callers fall back to the closure).
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import type { AccountConfig } from '../tools/helpers/config.js'

export interface EmailSubjectScope {
  /** JWT sub claim (per-session UUID minted by mcp-core at /authorize time). */
  sub: string
  /** Mailbox set belonging to this subject, loaded from the per-user store. */
  accounts: AccountConfig[]
  /** Raw credentials string for this subject. */
  rawCredentials?: string
}

export const subjectContext = new AsyncLocalStorage<EmailSubjectScope>()
