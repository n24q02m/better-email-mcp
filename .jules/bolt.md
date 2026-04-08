## 2026-04-08 - [Reduce PBKDF2 Iterations in Vitest Environment]
**Learning:** Cryptographic operations using PBKDF2 with high iteration counts (e.g., 600,000 iterations) are extremely slow and can lead to test timeouts (e.g., Vitest 5s limit) when run repeatedly in test suites.
**Action:** Use conditional iteration counts (e.g., `process.env.VITEST ? 1000 : 600_000`) to significantly reduce test execution time (from ~14s down to ~0.16s for the test file) while maintaining secure, high-iteration values in production.

## 2026-04-08 - [Use rundll32 for Windows Background Processes]
**Learning:** Spawning `cmd.exe` using `execFile` or `spawn` in background tasks on Windows CI runners (like GitHub Actions) can cause the workflow to hang and fail with exit code 1 due to lingering orphan processes.
**Action:** Use `rundll32 url.dll,FileProtocolHandler` to safely launch URLs on Windows without involving the `cmd.exe` shell layer.

## 2026-04-08 - [Prevent Orphaned Processes on Windows E2E Tests]
**Learning:** Spawning browsers or executing `cmd.exe`/`rundll32` via `execFile` in background tasks during E2E tests on Windows CI runners (e.g., GitHub Actions) can cause the workflow to hang and fail with exit code 1 due to orphaned processes.
**Action:** Bypass browser-opening utilities (like `tryOpenBrowser` and `openBrowser`) during E2E tests by adding early returns tied to specific environment variables (e.g., `if (process.env.E2E_SETUP) return`).
