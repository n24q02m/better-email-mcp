## 2025-05-01 - Missing URL validation for browser opening

**Vulnerability:** The `openBrowser` function in `src/tools/helpers/oauth2.ts` called `tryOpenBrowser` directly with unvalidated URLs, which could lead to shell injection or malicious browser behavior via crafted URIs (e.g. `javascript:alert(1)`).
**Learning:** Even internal helper wrappers that call external tools should enforce validation boundaries for untrusted inputs to prevent exploit chains.
**Prevention:** Always validate URLs using the `isSafeUrl` utility (which enforces protocol allowlists and rejects shell metacharacters) before passing them to OS-level or external browser utilities.

## 2024-05-18 - Missing CSP in Statically Generated HTML Form
**Vulnerability:** The statically generated HTML form `renderEmailCredentialForm` in `src/credential-form.ts` lacked a Content-Security-Policy (CSP). While the form correctly escaped user inputs, the lack of CSP exposed it to potential XSS and data exfiltration risks in a defense-in-depth context.
**Learning:** Static HTML generators that produce interactive forms must include strict CSP rules even if inputs seem securely escaped, especially when dealing with sensitive operations like credential management.
**Prevention:** Always add a strict `Content-Security-Policy` meta tag (e.g., `default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'`) to any generated HTML interface.
