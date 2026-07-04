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

## 2025-02-11 - Unvalidated JSON Parsing in OAuth Token Store
 **Vulnerability:** Unchecked `JSON.parse` output when loading the OAuth2 token store or encrypted configurations.
 **Learning:** Accessing properties on unvalidated `JSON.parse` results can cause runtime crashes (TypeErrors) if the file is malformed or contains unexpected primitive values.
 **Prevention:** Use robust type guards (`isValidTokenStore`, `isValidAccountConfigs`) immediately after parsing. Ensure these guards check for `null`, `Array.isArray`, and validate internal field types and constraints (e.g., non-empty strings for tokens, positive numbers for expiration).

## 2026-05-28 - Unvalidated JSON Parsing in OAuth Token Store
**Vulnerability:** The OAuth token store in `src/tools/helpers/oauth2.ts` (`loadStoredTokens`, `loadOutlookEmails`, `saveTokensToFile`) parsed JSON from disk and cast it directly without structural validation or protection against prototype pollution. If the file was maliciously modified to include `__proto__` properties, consumers could experience prototype pollution leading to privilege escalation or unexpected behavior.
**Learning:** Always use a defensive parsing wrapper (`Object.create(null)` and explicit key deletion) when parsing locally cached JSON objects that will be merged or treated as configurations, even if the file is supposedly managed by the application.
**Prevention:** Implement a `parseTokenStore` utility that uses `JSON.parse`, validates the result, and sanitizes the object by mapping properties onto a null-prototype object and deleting potentially dangerous keys (`__proto__`, `constructor`, `prototype`).
## 2025-05-22 - [TEST] Test Coverage for imap-client.ts
 **Vulnerability:** Untested public function clearSentFolderCache.
 **Learning:** Testing internal caches requires explicit invalidation and verification that the system correctly falls back to re-fetching data. Mocking complex structures like email addresses and attachments requires precision to cover all logical branches (fallbacks for missing fields).
 **Prevention:** Use coverage tools (vitest --coverage) early to identify gaps in helper functions and edge case handlers.

## 2024-05-30 - [DOM-based XSS Prevention in Client-Side Redirects]
**Vulnerability:** The application was vulnerable to DOM-based XSS when assigning an untrusted, unvalidated `redirect_url` to `pendingRedirectUrl`, which was subsequently used in `window.location.replace()`.
**Learning:** Even URLs provided by a supposedly trusted backend API response can be maliciously crafted or influenced, posing a risk when used in client-side navigation sinks. They must always be treated as untrusted and validated.
**Prevention:** Explicitly parse the URL using `new URL(url, window.location.href)` and strictly validate that the `protocol` is safe (e.g., `http:` or `https:`) before utilizing it in `window.location.replace` or `window.location.assign`.
