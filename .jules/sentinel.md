## 2025-05-01 - Missing URL validation for browser opening

**Vulnerability:** The `openBrowser` function in `src/tools/helpers/oauth2.ts` called `tryOpenBrowser` directly with unvalidated URLs, which could lead to shell injection or malicious browser behavior via crafted URIs (e.g. `javascript:alert(1)`).
**Learning:** Even internal helper wrappers that call external tools should enforce validation boundaries for untrusted inputs to prevent exploit chains.
**Prevention:** Always validate URLs using the `isSafeUrl` utility (which enforces protocol allowlists and rejects shell metacharacters) before passing them to OS-level or external browser utilities.
## 2025-02-20 - Add CSP and secure submitUrl injection to HTTP credential form
**Vulnerability:** The `src/credential-form.ts` rendered an inline script tag passing the `submitUrl` configuration without proper encoding (relying on `escapeHtml` which does not escape for JSON/JS context and causes double encoding or XSS). Additionally, the HTML form did not have a Content Security Policy (CSP).
**Learning:** For server-side rendering of inline script parameters, `JSON.stringify` should be used alongside string replacement for `<` (`.replace(/</g, '\\u003c')`) to prevent XSS string breakout. Statically rendered pages should also assert defense-in-depth with CSP meta tags to restrict execution sources.
**Prevention:** Always use `JSON.stringify` and `</script>` breakout mitigations for JS interpolation, and inject strong `default-src 'none'` CSP tags for static template outputs.
