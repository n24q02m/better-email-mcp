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
## 2024-05-23 - Bypass unnecessary html-to-text in mailparser snippets
**Learning:** `mailparser`'s `simpleParser` performs expensive HTML-to-text conversion by default, even when we already discard it in favor of a faster custom `fastExtractSnippet` fallback. This can add 1-2 seconds per email parsed for large messages.
**Action:** Always pass `{ skipHtmlToText: true, skipTextToHtml: true, skipTextLinks: true }` to `simpleParser` when only basic metadata, text, or raw HTML is needed.

## 2026-05-18 - [Precompile html-to-text options]
**Learning:** `html-to-text`'s `convert` function rebuilds formatting and parsing rules from the provided options object on every invocation. When called frequently (e.g., parsing multiple search results), this dynamic setup introduces significant overhead.
**Action:** Use the `compile` function from `html-to-text` to create a precompiled converter function during module initialization. This avoids redundant configuration parsing on every call and can be up to 5x faster.

## 2025-02-23 - Bypass mailparser slow HTML-to-text processing
**Learning:** `simpleParser` from `mailparser` can be extremely slow on large emails because it does full HTML-to-text conversion by default. This is often unnecessary when extracting attachments or when we already have a faster custom HTML-to-text parser (like our compiled `html-to-text`).
**Action:** Always pass `{ skipHtmlToText: true, skipTextToHtml: true, skipTextLinks: true }` to `simpleParser` when full text extraction is not needed or when using an alternative HTML parser.
## 2024-05-18 - Bigram Caching for Static Valid Options
**Learning:** In string matching algorithms like `findClosestMatch` that compare user input against a static list of valid options, recomputing bigrams for the static options on every invocation is a significant overhead, especially since the number of valid options is small and fixed (e.g., tool names like "messages", "folders").
**Action:** Always look for opportunities to pre-compute and cache derived data (like bigrams or regular expressions) for static, bounded sets to convert repeated allocations and string operations into fast memory lookups. A simple `Map` reduced the overhead for fuzzy matching by ~2.5x.

## 2026-05-18 - [Hoist Regex Patterns for High-Frequency String Processing]
**Learning:** Functions like `fastExtractSnippet` and `escapeHtml` that are called frequently during hot paths (such as parsing large batches of IMAP search results) incur significant performance overhead if they inline regex literals. JavaScript engines compile the regex literal and allocate memory for a new `RegExp` object on every function invocation.
**Action:** Extract all regular expressions used in hot paths into module-scoped constants (e.g., `const FAST_EXTRACT_TAG_REGEX = /<[^>]+>/g`). This pre-compiles the regex once at module load time, bypassing recompilation and garbage collection overheads on every call, leading to a substantial speedup (~30-40% for snippet extraction).
