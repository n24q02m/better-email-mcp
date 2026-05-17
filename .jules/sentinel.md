## 2025-05-01 - Missing URL validation for browser opening

**Vulnerability:** The `openBrowser` function in `src/tools/helpers/oauth2.ts` called `tryOpenBrowser` directly with unvalidated URLs, which could lead to shell injection or malicious browser behavior via crafted URIs (e.g. `javascript:alert(1)`).
**Learning:** Even internal helper wrappers that call external tools should enforce validation boundaries for untrusted inputs to prevent exploit chains.
**Prevention:** Always validate URLs using the `isSafeUrl` utility (which enforces protocol allowlists and rejects shell metacharacters) before passing them to OS-level or external browser utilities.

## 2026-05-17 - XSS via Inline Script Injection

**Vulnerability:** The `submitUrl` string was injected into an inline `<script>` tag using `escapeHtml()`. This allowed for script breakout attacks because HTML entities are not unescaped inside script contexts.
**Learning:** Using `escapeHtml()` inside a JS block is insufficient for preventing XSS. Safe serialization requires `JSON.stringify()` combined with replacing `<` with `<`.
**Prevention:** Use `JSON.stringify()` for data injected into scripts and apply a strict `Content-Security-Policy` to disable inline scripts where possible or limit them strictly.
