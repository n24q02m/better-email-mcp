## 2026-04-11 - Pre-compile RegExp for Performance
**Learning:** Constructing RegExp instances dynamically in hot paths like message search criteria processing creates measurable garbage collection overhead and redundant CPU work.
**Action:** Extract loop-based regular expressions into pre-compiled top-level module constants when their patterns are static.
