## 2026-04-22 - [Fast-fail IMAP validation]
**Learning:** In `validateImapAccounts`, using `Promise.all` mapping over `testImapConnection` will wait for all connection tests to complete before resolving, even if an early failure occurs (e.g. an incorrect password vs a 15-second timeout). This delays the return of the error to the user interface.
**Action:** Implement a "fail-fast" pattern by checking for a non-null result (failure) inside the map callback and `throw`ing the error object immediately. This triggers `Promise.all`'s short-circuit behavior, catching the thrown object and immediately resolving/returning it.
## 2026-04-23 - [Precompute loop invariants]
**Learning:** In fuzzy matching loops (e.g. `findClosestMatch`), recalculating loop invariants (like `inputBigrams` for the constant input string) on every iteration causes massive redundant allocation overhead, changing the time complexity from O(N+M) to O(N*M).
**Action:** Always identify operations inside loops that do not depend on the iteration variable and extract them (pre-compute them) before the loop starts to avoid redundant processing.
