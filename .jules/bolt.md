
## 2024-05-20 - [Async saveTokens]
**Learning:** Replacing synchronous file operations with asynchronous versions in frequently called functions like \`saveTokens\` requires concurrent access control (like a Promise lock) to prevent race conditions during read/write sequences which can corrupt JSON files.
**Action:** Implemented a \`saveLock\` Promise queue to serialize calls to \`saveTokens\`, ensuring safe async I/O without blocking the Node event loop.
