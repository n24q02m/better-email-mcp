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

## 2026-06-15 - [Avoid requesting bodyStructure unless needed]
**Learning:** When fetching emails via IMAP (e.g., in `searchEmails`), requesting `bodyStructure: true` forces the server to parse the MIME tree and transmit extra data, causing significant performance and network overhead, even when the response is not utilized by the client code.
**Action:** Remove `bodyStructure: true` from the `fetchAll` options in `searchEmails` and other places where the full MIME structure is not strictly required.

## 2025-05-18 - [V8 RegExp replacement overhead]
**Learning:** In V8 environments (Node.js/Bun), using chained `.replace()` calls with string literal replacements is measurably faster than using a single global `.replace()` with a mapping callback for simple escaping tasks (e.g. HTML escaping). The overhead comes from V8 needing to cross the C++/JS boundary and invoke the JS callback for every regex match.
**Action:** Always prefer chained `.replace()` with string literal replacements for simple, fixed-mapping string replacements instead of a single mapping callback, especially in hot-path or frequently called utilities.
## 2023-06-28 - Extract Inline RegExp Literals and Remove Redundant .test()

**Learning:** V8 recompiles inline literal regular expressions if they appear inside high-frequency loops or hot paths like `map` functions and query parsing (`buildSearchCriteria`). Additionally, calling `.test()` before a global replace operation (`.replace(/.../g, '')`) is an anti-pattern. If the pattern is missing, both `.test()` and `.replace()` perform an `O(N)` scan, but the `.replace()` fast-path returns the original string with zero reallocation.

**Action:** Always pre-compile regular expressions by extracting them to module-scoped constants (`const RE_... = /.../g`), avoiding instantiation on every function invocation. Remove redundant `if (pattern.test(text))` checks before `.replace()` logic, especially in loops, to minimize string scanning overhead.
## 2026-06-25 - [Avoid redundant .test() checks]
**Learning:** Checking a regular expression match with `.test()` before performing a `.replace()` (e.g. `if (pattern.test(str)) { str = str.replace(pattern, ' ') }`) is a redundant anti-pattern. If the pattern is missing, both methods scan the string, but `.replace()` on V8 handles no-matches quickly with zero reallocation. Using both means performing a double O(N) scan.
**Action:** Remove the redundant `pattern.test()` and perform the `.replace()` directly. Compare the newly returned string against the original string (e.g. `if (next !== original) { ... }`) to detect if a replacement occurred.
## 2025-02-18 - [Optimize findClosestMatch fast-path]
**Learning:** In hot paths where fuzzy matching is employed (like `findClosestMatch`), if the majority of cases match exactly or are prefixes, deferring the allocation of bigram structures (`Set` allocation and population) for the fuzzy-logic fallback leads to measurable optimization. Separating exact/prefix matching from fuzzy matching into two passes allows early return for common cases with zero bigram overhead.
**Action:** Always consider inserting a zero-allocation fast-path before performing resource-intensive matching or scoring logic, especially when exact hits or simple startsWith/includes checks resolve the majority of calls.

## 2024-05-18 - [Optimize property whitelisting]
**Learning:** In V8 (Node.js/Bun), using the `in` operator inside a loop to check property existence on objects (e.g. `prop in obj`) can be slow because it triggers prototype chain traversal. Direct property access checks (e.g., `obj[prop] !== undefined`) are significantly faster for whitelisting known properties on error objects.
**Action:** Avoid the `in` operator for static property whitelisting. Extract property lists to module-scoped constants to prevent array allocation, and use direct access checks inside the loop instead.
