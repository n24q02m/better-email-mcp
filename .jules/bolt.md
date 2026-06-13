## 2025-05-15 - Optimized Fuzzy Matching with Numeric Bigrams

**Learning:** String slicing and `Set<string>` in hot loops (like fuzzy matching) create significant GC pressure and overhead. Representing bigrams as `(char1 << 16) | char2` numeric values eliminates string allocations and speeds up lookups.

**Action:** Use numeric bit-packing for small fixed-size string fragments (like bigrams or trigrams) when performing intensive similarity calculations or caching.
