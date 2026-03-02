## 2026-03-02 - Cache Archive Folder Listing promises
**Learning:** Naive in-memory Map caches can suffer from cache stampedes if they only store the finalized value, especially when the cache population takes a long time (like IMAP folder listing) and requests can arrive concurrently.
**Action:** When caching expensive asynchronous lookups, store the pending `Promise` inside the cache map itself. This allows subsequent concurrent requests to `await` the same resolution process instead of firing off redundant underlying operations.
