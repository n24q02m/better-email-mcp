## 2025-05-01 - Missing URL validation for browser opening

**Vulnerability:** The `openBrowser` function in `src/tools/helpers/oauth2.ts` called `tryOpenBrowser` directly with unvalidated URLs, which could lead to shell injection or malicious browser behavior via crafted URIs (e.g. `javascript:alert(1)`).
**Learning:** Even internal helper wrappers that call external tools should enforce validation boundaries for untrusted inputs to prevent exploit chains.
**Prevention:** Always validate URLs using the `isSafeUrl` utility (which enforces protocol allowlists and rejects shell metacharacters) before passing them to OS-level or external browser utilities.
## 2024-05-13 - Add Content-Security-Policy to credential form
**Vulnerability:** The statically generated credential form in `src/credential-form.ts` was missing a `Content-Security-Policy` header/meta tag. This could potentially allow Cross-Site Scripting (XSS) or data exfiltration if an attacker managed to inject malicious scripts into the page context.
**Learning:** Statically generated HTML forms should include a strict `Content-Security-Policy` meta tag as a defense-in-depth measure against XSS and data exfiltration, even if input appears to be properly escaped.
**Prevention:** Ensure that all dynamically generated or statically served HTML content includes a robust CSP meta tag defining strict rules for scripts, styles, and external connections (e.g., `default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'`).
