## 2026-04-10 - Enhanced URL Safety Testing
 **Vulnerability:** Insufficient testing of `isSafeUrl` utility, specifically the error handling path for malformed URLs and potential HTML entity bypasses.
 **Learning:** Node.js `URL` constructor has specific failure modes for strings like `http://`, `://`, and malformed IPv6 addresses, which must be explicitly verified to ensure the utility fails closed (returns `false`). HTML entities like `data&colon;` can also be used in bypass attempts.
 **Prevention:** Use a comprehensive test suite that includes not just protocol allowlists, but also malformed strings and encoded bypass vectors to ensure security utilities handle all edge cases correctly.
