## 2025-05-01 - Missing URL validation for browser opening

**Vulnerability:** The `openBrowser` function in `src/tools/helpers/oauth2.ts` called `tryOpenBrowser` directly with unvalidated URLs, which could lead to shell injection or malicious browser behavior via crafted URIs (e.g. `javascript:alert(1)`).
**Learning:** Even internal helper wrappers that call external tools should enforce validation boundaries for untrusted inputs to prevent exploit chains.
**Prevention:** Always validate URLs using the `isSafeUrl` utility (which enforces protocol allowlists and rejects shell metacharacters) before passing them to OS-level or external browser utilities.

## 2025-02-28 - Missing Content Security Policy
**Vulnerability:** The HTML form rendered by `src/credential-form.ts` was missing a Content-Security-Policy (CSP) header. Without a CSP, the browser might be susceptible to loading unauthorized external resources or performing unauthorized network requests (like data exfiltration) if an XSS vulnerability were introduced.
**Learning:** Even statically generated forms using `unsafe-inline` scripts should restrict other origins via CSP to minimize attack surface and prevent data exfiltration.
**Prevention:** Always include a `Content-Security-Policy` meta tag or HTTP header (e.g. `default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'`) when serving HTML pages to strictly enforce origin boundaries.
