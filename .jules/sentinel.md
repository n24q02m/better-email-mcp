## 2025-05-01 - Missing URL validation for browser opening

**Vulnerability:** The `openBrowser` function in `src/tools/helpers/oauth2.ts` called `tryOpenBrowser` directly with unvalidated URLs, which could lead to shell injection or malicious browser behavior via crafted URIs (e.g. `javascript:alert(1)`).
**Learning:** Even internal helper wrappers that call external tools should enforce validation boundaries for untrusted inputs to prevent exploit chains.
**Prevention:** Always validate URLs using the `isSafeUrl` utility (which enforces protocol allowlists and rejects shell metacharacters) before passing them to OS-level or external browser utilities.

## 2025-05-21 - Missing Content Security Policy in Credential Form

**Vulnerability:** The statically generated HTML form `renderEmailCredentialForm` lacked a `Content-Security-Policy` meta tag, making it more susceptible to potential Cross-Site Scripting (XSS) or data exfiltration if an injection vulnerability existed elsewhere.
**Learning:** Defense-in-depth requires statically generated HTML to enforce strict CSP, even if user input is properly escaped.
**Prevention:** Include a strict CSP meta tag (`default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'`) in statically served forms to mitigate the impact of injection flaws.
## 2026-05-28 - Unvalidated JSON Parsing in OAuth Token Store
**Vulnerability:** The OAuth token store was parsing JSON from disk and immediately caching it without validating its structure. If the file was corrupted or maliciously modified to be valid JSON but missing required fields (like `accessToken`), consumers would crash or behave unexpectedly.
**Learning:** Always use structural validation (type guards) when reading persistent state or external data, even if it was previously written by the application itself.
**Prevention:** Implement `isValidTokens` and `isValidTokenStore` type guards to ensure data integrity before caching.

## 2026-05-28 - Unvalidated JSON Parsing in Credential Store
**Vulnerability:** The `loadUserCredentials` and `loadAllUserCredentials` functions in `src/auth/per-user-credential-store.ts` parsed decrypted JSON data and cast it directly to `AccountConfig[]` without type validation. If the stored credentials file were corrupted or tampered with (e.g. by another process or an attacker with local write access), this could lead to runtime errors or potentially more serious logic flaws when the malformed config is used by the system.
**Learning:** Decrypting data only ensures its confidentiality and integrity (if using AEAD like AES-GCM) relative to the key. It does not guarantee that the decrypted content conforms to the expected application-level schema.
**Prevention:** Always implement strict type guards (using manual checks or schemas like Zod) to validate parsed JSON data immediately after decoding and before casting to internal types, especially for persistent storage or data received over a network.

## 2026-05-28 - Insecure Default for PBKDF2 Iterations via Environment Variable

**Vulnerability:** The `deriveKey` function in `src/auth/per-user-credential-store.ts` used a generic `process.env.VITEST` check to downgrade PBKDF2 iterations from 600,000 to 1,000. This could potentially allow an attacker to downgrade security in production by setting the `VITEST` environment variable.
**Learning:** Security-sensitive parameters like cryptographic iteration counts should rely on strict environment checks (e.g., `NODE_ENV === 'test'`) rather than generic or easily spoofable variables.
**Prevention:** Use `process.env.NODE_ENV === 'test'` for test-only security downgrades and allow sensitive parameters to be explicitly configured via function arguments to avoid reliance on global state.
## 2025-05-15 - Unvalidated JSON Parsing in Credential Store
 **Vulnerability:** Unvalidated `JSON.parse` results could lead to `TypeError` (e.g., when parsing `null`) or logic errors (e.g., when parsing primitives) when properties like `.accounts` are accessed.
 **Learning:** Always validate that the result of `JSON.parse` is a non-null object before accessing properties, especially for data coming from storage or external sources.
 **Prevention:** Use type guards or schema validation (like Zod) immediately after `JSON.parse` to ensure the payload matches the expected structure.
