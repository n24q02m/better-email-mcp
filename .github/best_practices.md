# Style Guide - better-email-mcp

## Architecture
MCP server for Email (IMAP/SMTP). TypeScript, single-package repo.

## TypeScript
- Formatter/Linter: Biome (2 spaces, double quotes, semicolons)
- Build: esbuild (bundle to single file)
- Test: Vitest
- Runtime: Node.js (ES modules)
- SDK: @modelcontextprotocol/sdk, imapflow, nodemailer

## Code Patterns
- Multi-account support: resolve account by name or auto-detect
- IMAP connections managed with connection pooling
- HTML email generation from markdown with sanitization
- Attachment handling with proper MIME types
- Zod for input validation on all tool parameters

## Commits
Conventional Commits (feat:, fix:, chore:, docs:, refactor:, test:).

## Security
Never hardcode credentials. Sanitize email body to prevent XSS. No sensitive data in logs.
