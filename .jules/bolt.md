## 2026-04-08 - [Reduce PBKDF2 Iterations in Vitest Environment]
**Learning:** Cryptographic operations using PBKDF2 with high iteration counts (e.g., 600,000 iterations) are extremely slow and can lead to test timeouts (e.g., Vitest 5s limit) when run repeatedly in test suites.
**Action:** Use conditional iteration counts (e.g., `process.env.VITEST ? 1000 : 600_000`) to significantly reduce test execution time (from ~14s down to ~0.16s for the test file) while maintaining secure, high-iteration values in production.
