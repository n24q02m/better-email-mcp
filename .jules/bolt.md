## 2025-05-15 - Refactored `withErrorHandling` to remove `any`

**Learning:** Using `any` in higher-order functions like `withErrorHandling` bypasses TypeScript's type checking for the wrapped function's arguments and return type.

**Action:** Use generics `<Args extends unknown[], R>` to maintain strict type safety while allowing the function to be flexible. This ensures that callers of the wrapped function still benefit from IDE autocompletion and type checking.

## 2025-05-15 - Improved error type safety in `enhanceError`

**Learning:** Handling raw errors as `unknown` requires frequent type casting or `as Record<string, unknown>`, which is error-prone.

**Action:** Define a `RawError` interface that captures common error properties (like `message`, `code`, `responseCode`) and use a type guard (`isRawError`) to safely narrow the type. This makes the logic cleaner and more robust against malformed error objects.

## 2025-05-15 - Standardizing Error Handling with Type Guards

**Learning:** Centralizing error processing logic using interfaces and type guards reduces cognitive load and prevents repetitive "as unknown as X" patterns across the codebase.

**Action:** Consistently use the `RawError` interface and `isRawError` guard in any new error-handling utilities to ensure uniform processing and sanitization of error objects.
