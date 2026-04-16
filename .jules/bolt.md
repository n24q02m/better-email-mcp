## 2024-04-16 - [PERF] Parallelize IMAP connection tests
**Learning:** Sequential `await` calls in loops for independent network operations (like validating multiple IMAP credentials during server startup) introduce unnecessary latency that scales linearly with the number of accounts.
**Action:** Use `Promise.all` with `Array.prototype.map` to concurrently execute independent I/O-bound tasks. Retain sequential error reporting by finding the first encountered error in the results array to preserve original behavior.
