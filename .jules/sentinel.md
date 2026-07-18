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

## 2026-07-03 - DOM-based XSS via Unvalidated Client-Side Redirect
**Vulnerability:** The `window.location.replace()` function in the frontend credential form (`src/credential-form.ts`) used unvalidated `redirect_url` payloads obtained from backend JSON responses. While the backend provided this URL, an attacker could potentially manipulate the URL via the original POST request or another vector to inject a `javascript:` URI, leading to a DOM-based Cross-Site Scripting (XSS) execution.
**Learning:** Even URLs originating from a seemingly trusted backend API must be explicitly validated on the client side before being used in sensitive DOM sinks like `window.location`.
**Prevention:** Always parse and validate the protocol of user-influenced URLs using robust parsers (e.g., `new URL()`) and ensure the protocol is restricted to safe schemes (`http:` or `https:`) before using them for redirection or navigation.
## 2025-05-22 - XSS via innerHTML in form submission
**Vulnerability:** The credential form directly assigned dynamic UI string containing nested HTML markup using `.innerHTML` on a submit button.
**Learning:** Any use of `.innerHTML` even with static-appearing data sets up a brittle pattern where future additions could inadvertently expose the application to Cross-Site Scripting (XSS).
**Prevention:** Always use safe DOM traversal manipulation utilizing `document.createElement`, `setAttribute`, and `textContent` or `document.createTextNode` instead of string interpolation and `innerHTML`.
## 2026-07-09 - Missing Security Headers in Proxy Fetch
**Vulnerability:** The `fetch` entrypoint in `src/worker.ts` proxied requests to the container process but forwarded the response directly to the client without setting critical security headers. This omission exposed the application to MIME-sniffing, clickjacking, and potential man-in-the-middle downgrade attacks.
**Learning:** When acting as a reverse proxy or gateway (like in a Cloudflare Worker), you must explicitly attach security headers (e.g., `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`) to the cloned response before returning it to the client, as the backend container might not set them by default.
**Prevention:** Always use a `new Response` wrapper around proxied fetches to inject standard security headers (e.g., `nosniff`, `DENY`, `max-age`) on the outbound `Headers` object.
## 2026-07-10 - [Global Security Headers in Cloudflare Worker]
**Vulnerability:** The Cloudflare worker `fetch` handler added security headers (HSTS, X-Content-Type-Options, X-Frame-Options) only to the responses successfully proxied from the Durable Object. All other responses, such as 401 Unauthenticated, 404 Not Found, and 405 Method Not Allowed, were returned without any security headers, exposing these endpoints to MIME-sniffing or clickjacking risks.
**Learning:** In edge routing patterns like Cloudflare Workers where the edge performs initial authentication or method checking before delegating to another service (like a Durable Object), it is a common blind spot to only secure the "happy path" proxy response. The edge router's own generated responses must also be secured.
**Prevention:** Implement a global response wrapper function (e.g., `withSecurityHeaders(response: Response)`) that clones and sets standard security headers on *every* outbound response originating from the worker, regardless of the response's status code or source.
## 2025-05-22 - Missing security headers on proxy outbound responses
**Vulnerability:** The `kvOutbound` handler for proxy outbound responses lacked security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`), whereas the main `fetch` handler included them via `withSecurityHeaders`.
**Learning:** Even internal API endpoints or proxy outbound responses can be exploited (e.g., MIME-sniffing, clickjacking) if an attacker can manipulate how they are loaded in a browser context. Security headers must be explicitly applied uniformly to all edge/proxy generated responses.
**Prevention:** In Cloudflare Workers and proxy-heavy architectures, enforce a global wrapper like `withSecurityHeaders(...)` to uniformly apply security headers to *all* returning `Response` objects regardless of the route or underlying handler.
## 2026-07-17 - Rejected Security Headers on Internal KV Proxy
**Vulnerability:** A PR was created to add security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`) to the `kvOutbound` handler in `src/worker.ts`.
**Learning:** The `kvOutbound` handler is strictly internal. It is reached solely via the container `ContainerProxy` for `http://kv.internal/` outbound dispatch and is explicitly not routed from the public `fetch` path to prevent spoofing. Its response is a binary AES-GCM credential blob consumed entirely server-side by `PerSubCredStore`. Because these responses are never rendered or consumed in a browser context, browser-centric security headers (like HSTS or X-Frame-Options) provide zero security benefit and are considered security theater / unnecessary scope creep.
**Prevention:** Before applying browser security headers to internal service-to-service communication paths, verify if the response will ever reach a browser client. If the endpoint strictly serves binary data to a backend consumer and is isolated from external ingress, do not apply web-centric security headers.
