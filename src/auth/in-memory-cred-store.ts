/**
 * Per-user credential store with in-memory storage only (TC-NearZK).
 *
 * Replaces deprecated per-user-credential-store.ts (disk-encrypted
 * AES-GCM + PBKDF2) for HTTP multi-user mode. v1.0+ aligns with Notion's
 * in-memory pattern: server has access during request lifetime; restart
 * clears all credentials, users re-OAuth.
 *
 * Trust model: server admin (n24q02m operator) can dump live memory via
 * debugger but no persistent file = no FS-dump compromise + no admin
 * recovery from disk.
 */
export interface CredentialPayload {
  [key: string]: unknown
}

export class InMemoryCredStore {
  private store = new Map<string, CredentialPayload>()

  async save(sub: string, creds: CredentialPayload): Promise<void> {
    this.store.set(sub, { ...creds })
  }

  async load(sub: string): Promise<CredentialPayload | null> {
    const value = this.store.get(sub)
    return value ?? null
  }

  async clear(sub: string): Promise<void> {
    this.store.delete(sub)
  }

  async listSubs(): Promise<string[]> {
    return [...this.store.keys()]
  }
}
