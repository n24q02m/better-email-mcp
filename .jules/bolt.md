## 2025-02-12 - Prevented regexp re-compilations in search queries
**Learning:** Re-compiling regular expressions dynamically using `new RegExp()` inside functions (like `buildSearchCriteria`) introduces GC overhead and impacts performance, especially in loops.
**Action:** Always extract static regular expressions into module-scoped constants to prevent them from being recreated on each function invocation.
