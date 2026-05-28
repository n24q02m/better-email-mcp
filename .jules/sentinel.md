## 2025-05-01 - Missing URL validation for browser opening

**Vulnerability:** The `openBrowser` function in `src/tools/helpers/oauth2.ts` called `tryOpenBrowser` directly with unvalidated URLs, which could lead to shell injection or malicious browser behavior via crafted URIs (e.g. `javascript:alert(1)`).
**Learning:** Even internal helper wrappers that call external tools should enforce validation boundaries for untrusted inputs to prevent exploit chains.
**Prevention:** Always validate URLs using the `isSafeUrl` utility (which enforces protocol allowlists and rejects shell metacharacters) before passing them to OS-level or external browser utilities.

## 2025-05-21 - Missing Content Security Policy in Credential Form

**Vulnerability:** The statically generated HTML form `renderEmailCredentialForm` lacked a `Content-Security-Policy` meta tag, making it more susceptible to potential Cross-Site Scripting (XSS) or data exfiltration if an injection vulnerability existed elsewhere.
**Learning:** Defense-in-depth requires statically generated HTML to enforce strict CSP, even if user input is properly escaped.
**Prevention:** Include a strict CSP meta tag (`default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'`) in statically served forms to mitigate the impact of injection flaws.

## 2026-06-21 - [Type Safety] Avoid any in Error Sanitization
**Vulnerability:** Use of `any` in `sanitizeErrorDetails` and `withErrorHandling` could lead to accidental leakage of sensitive information or runtime errors if the type assumptions are incorrect.
**Learning:** Using `unknown` and proper type guards/narrowing is safer than `any` for processing objects of unknown structure.
**Prevention:** Strictly use `unknown` for error payloads and narrow types using `typeof` and `in` operator before accessing properties.
