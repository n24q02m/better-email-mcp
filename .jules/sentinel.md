## 2025-05-01 - Missing URL validation for browser opening

**Vulnerability:** The `openBrowser` function in `src/tools/helpers/oauth2.ts` called `tryOpenBrowser` directly with unvalidated URLs, which could lead to shell injection or malicious browser behavior via crafted URIs (e.g. `javascript:alert(1)`).
**Learning:** Even internal helper wrappers that call external tools should enforce validation boundaries for untrusted inputs to prevent exploit chains.
**Prevention:** Always validate URLs using the `isSafeUrl` utility (which enforces protocol allowlists and rejects shell metacharacters) before passing them to OS-level or external browser utilities.

## 2025-05-19 - Missing Content-Security-Policy and Unsafe Inline Script Variables in HTML Forms
**Vulnerability:** The statically generated `renderEmailCredentialForm` form lacked a strict Content-Security-Policy (CSP) meta tag. In addition, the `submitUrl` variable was being injected into the inline `<script>` tag using `escapeHtml()`, which could lead to syntax errors on encoded ampersands, or potential script breakout if not handled correctly.
**Learning:** For HTML templates where server variables are injected into inline scripts, `JSON.stringify(var).replace(/</g, '\\u003c')` must be used instead of HTML escaping to safely serialize JavaScript and prevent XSS. A strict CSP should also always be included.
**Prevention:** Statically generated HTML must always include a `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'">` tag, and inline script variables must be properly serialized as JSON.
