## 🎯 What
The `registerTools` function in `src/tools/registry.ts` was mostly untested. It is responsible for setting up the MCP server request handlers. This PR addresses this testing gap by mocking `node:fs/promises` and the composite tools, to verify the server wiring.

## 📊 Coverage
Added comprehensive tests covering the successful execution of all request handlers:
- `ListToolsRequestSchema` returns the expected tools list.
- `ListResourcesRequestSchema` returns the expected resources list.
- `ReadResourceRequestSchema` successfully returns file content or throws an expected error if missing.
- `CallToolRequestSchema` properly extracts arguments and dispatches to the correct composite tool (`messages`, `folders`, `attachments`, `send`, `help`).

## ✨ Result
Increased confidence in `src/tools/registry.ts` because its most important function, the configuration of the server, is now tested successfully for both "happy paths" and failure scenarios without doing actual network operations.
