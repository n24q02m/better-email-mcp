## 2025-05-01 - Missing URL validation for browser opening

**Vulnerability:** The `openBrowser` function in `src/tools/helpers/oauth2.ts` called `tryOpenBrowser` directly with unvalidated URLs, which could lead to shell injection or malicious browser behavior via crafted URIs (e.g. `javascript:alert(1)`).
**Learning:** Even internal helper wrappers that call external tools should enforce validation boundaries for untrusted inputs to prevent exploit chains.
**Prevention:** Always validate URLs using the `isSafeUrl` utility (which enforces protocol allowlists and rejects shell metacharacters) before passing them to OS-level or external browser utilities.

## 2026-05-18 - Missing Content Security Policy on static UI elements

**Vulnerability:** The statically generated UI credential form `renderEmailCredentialForm` lacked a `Content-Security-Policy` header or meta tag, allowing potentially relaxed browser defaults that might increase the impact of XSS or enable exfiltration of sensitive credentials if other vulnerabilities are found.
**Learning:** Defense in depth dictates that static HTML injected or served by tools should explicitly constrain execution contexts and resource loading using strict CSPs, regardless of the lack of user-provided HTML.
**Prevention:** Apply a strict `Content-Security-Policy` meta tag (e.g., `default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'`) on all rendered web interfaces, preventing unintended connections or script sources.
