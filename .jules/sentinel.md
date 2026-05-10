## 2025-05-01 - Missing URL validation for browser opening

**Vulnerability:** The `openBrowser` function in `src/tools/helpers/oauth2.ts` called `tryOpenBrowser` directly with unvalidated URLs, which could lead to shell injection or malicious browser behavior via crafted URIs (e.g. `javascript:alert(1)`).
**Learning:** Even internal helper wrappers that call external tools should enforce validation boundaries for untrusted inputs to prevent exploit chains.
**Prevention:** Always validate URLs using the `isSafeUrl` utility (which enforces protocol allowlists and rejects shell metacharacters) before passing them to OS-level or external browser utilities.
## 2025-05-02 - Add Content Security Policy to Statically Generated UI Form
**Vulnerability:** Missing Content-Security-Policy header in dynamically constructed HTML forms (`src/credential-form.ts`).
**Learning:** Even statically generated HTML (like `renderEmailCredentialForm`) intended for local network / user rendering needs a strict CSP to prevent XSS in case of unescaped content or compromised templates.
**Prevention:** Statically generated HTML forms should include a strict Content-Security-Policy meta tag as a defense-in-depth measure against XSS and data exfiltration.
