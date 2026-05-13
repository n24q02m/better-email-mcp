## 2026-04-22 - [Fast-fail IMAP validation]
**Learning:** In `validateImapAccounts`, using `Promise.all` mapping over `testImapConnection` will wait for all connection tests to complete before resolving, even if an early failure occurs (e.g. an incorrect password vs a 15-second timeout). This delays the return of the error to the user interface.
**Action:** Implement a "fail-fast" pattern by checking for a non-null result (failure) inside the map callback and `throw`ing the error object immediately. This triggers `Promise.all`'s short-circuit behavior, catching the thrown object and immediately resolving/returning it.
## 2026-04-23 - [Precompute loop invariants]
**Learning:** In fuzzy matching loops (e.g. `findClosestMatch`), recalculating loop invariants (like `inputBigrams` for the constant input string) on every iteration causes massive redundant allocation overhead, changing the time complexity from O(N+M) to O(N*M).
**Action:** Always identify operations inside loops that do not depend on the iteration variable and extract them (pre-compute them) before the loop starts to avoid redundant processing.

## 2025-05-18 - Replacing `Promise.all` with Sequential `for...of` Loop for CPU-Heavy Tasks
**Learning:** In Node.js, using `Promise.all` alongside `.map()` to iterate over a large array of items containing CPU-intensive synchronous operations (like MIME parsing via `mailparser.simpleParser`) causes an unbound concurrent execution. This leads to severe event loop blocking and significant memory spikes, which degrades overall performance and responsiveness.
**Action:** When executing expensive CPU-bound synchronous tasks over a collection in an asynchronous context, iterate sequentially using a `for...of` loop instead of `Promise.all`. This allows the event loop to yield appropriately between tasks and maintains a stable memory footprint.

## 2026-05-01 - [Avoid Promise.all for WebCrypto PBKDF2 Iterations]
**Learning:** In `loadAllUserCredentials()`, reading the `entries` array (user directories) with `Promise.all(entries.map(...))` to derive an AES-GCM key using `crypto.subtle.deriveKey` (PBKDF2) triggers unbounded parallel cryptographic work. Node.js executes `crypto.subtle` tasks in its libuv thread pool. Submitting many heavy tasks (like 100k iteration PBKDF2s) at once quickly exhausts the thread pool, starving the event loop of I/O capability and heavily spiking the application's memory usage and startup/hot-reload latency.
**Action:** When performing heavy cryptographic operations (especially Key Derivation Functions like PBKDF2) across a dynamically sized list of entities, always use a sequential `for...of` loop instead of `Promise.all` to keep memory pressure low and preserve available thread-pool threads for the rest of the application's asynchronous workload.

## 2024-05-07 - Avoid Unbounded Promise.all() on CPU-Heavy Operations
**Learning:** Using `Promise.all(items.map(...))` to execute CPU-intensive tasks (like `mailparser.simpleParser` for parsing emails) blocks the event loop and can cause memory spikes in high-concurrency situations, despite JavaScript's asynchronous nature.
**Action:** Use a concurrency-limited mapper like `mapLimit` to balance throughput and event loop responsiveness for intensive parallel workloads.
## 2024-05-14 - Bigram Calculation Optimization
**Learning:** The `findClosestMatch` fuzzy matching algorithm was calculating bigrams for static `validOptions` on every invocation, causing O(N*M) overhead for redundant `Set` allocations and string slicing.
**Action:** Implemented a module-level `Map` to memoize the generated bigrams for `validOptions`. By caching on the static tool names rather than arbitrary user inputs, unbounded memory growth is avoided while significantly reducing CPU overhead during fuzzy matching.
