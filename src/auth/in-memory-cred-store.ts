/**
 * Per-user credential store with in-memory storage only (TC-NearZK).
 *
 * The sole per-user credential store for HTTP multi-user mode. v1.0+ aligns
 * with Notion's in-memory pattern: server has access during request lifetime;
 * restart clears all credentials, users re-OAuth.
 *
 * Trust model: server admin (n24q02m operator) can dump live memory via
 * debugger but no persistent file = no FS-dump compromise + no admin
 * recovery from disk.
 */
export interface CredentialPayload {
  [key: string]: unknown
}

/**
 * Common interface satisfied by both the in-memory store (stdio / local
 * single-process) and the KV write-through `PerSubCredStore` (Cloudflare
 * deploy), so the HTTP transport can select either without branching on the
 * concrete type. `ready` is optional (KV-only startup probe).
 */
export interface CredStoreLike {
  save(sub: string, creds: CredentialPayload): Promise<void>
  load(sub: string): Promise<CredentialPayload | null>
  clear(sub: string): Promise<void>
  listSubs(): Promise<string[]>
  ready?(): Promise<void>
}

export class InMemoryCredStore implements CredStoreLike {
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
