## 2025-04-16 - Command Injection via Missing URL Validation in tryOpenBrowser

 **Vulnerability:** The `tryOpenBrowser` function in `src/credential-state.ts` was passing a URL directly from the relay server to `execFile` without validation. On Windows, using `rundll32 url.dll,FileProtocolHandler` with a `file://` or local path could lead to execution of arbitrary files.

 **Learning:** Even when using `execFile` to prevent shell injection, the arguments themselves must be validated if they are used by the child process in a way that can trigger further execution (like protocol handlers).

 **Prevention:** Always validate and canonicalize URLs using `new URL()` and restrict protocols to a safe allowlist (e.g., `http:`, `https:`) before passing them to system commands or protocol handlers.
