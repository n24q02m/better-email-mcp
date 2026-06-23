## 2025-05-14 - [Cleanup] Use of 'any' Type: enhanceError
 **Learning:** Using `unknown` with type guards is preferred over `any` for better type safety in error handling logic.
 **Action:** Refactored `enhanceError` and `handleSmtpError` to use `RawError` interface and `isRawError` type guard.
