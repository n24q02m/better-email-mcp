## 2026-04-07 - Insecure URL Validation Fallback

**Vulnerability:** The `isSafeUrl` function previously had an insecure blocklist fallback in its `catch` block. This fallback attempted to sanitize and check for dangerous protocols like `javascript:` manually, which is error-prone and could lead to XSS if bypasses were found.

**Learning:** Relying on a blocklist for security sanitization in a `catch` block when a primary parser fails is dangerous. If the parser (`new URL`) fails, the input should be treated as fundamentally untrusted and rejected.

**Prevention:** Always use a strict allowlist approach for protocol validation. If a URL cannot be parsed by the standard `new URL` constructor, it should be considered unsafe. The current implementation correctly returns `false` in the `catch` block, ensuring a "fail-closed" security posture.

**Verification:** Added comprehensive test cases in `src/tools/helpers/security.test.ts` to verify that malformed URLs (e.g., `http://`, `://`, `http://[::1]]`) and entity-encoded bypasses (e.g., `javascript&colon;`) are correctly blocked.
