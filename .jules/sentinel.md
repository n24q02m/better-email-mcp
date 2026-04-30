## 2025-02-27 - [Guarding Browser Launches Against Shell Injection]
**Vulnerability:** Unvalidated URLs passed to `tryOpenBrowser` can lead to shell injection or arbitrary protocol execution if an attacker provides a crafted payload.
**Learning:** All browser-launching utilities that eventually execute system commands (like `open`, `xdg-open`, or `start`) must strictly validate URLs before invocation.
**Prevention:** Always wrap `tryOpenBrowser` calls with `isSafeUrl` to enforce an explicit allowlist of safe protocols (`http:`, `https:`, etc.) and reject dangerous metacharacters.
