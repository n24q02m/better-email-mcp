# AGENTS.md - better-email-mcp

MCP Server for Email (IMAP/SMTP). TypeScript, Node.js >= 24, pnpm, ESM.

## Build / Lint / Test Commands

```bash
pnpm install                # Install dependencies
pnpm build                  # tsc --build && esbuild CLI bundle
pnpm check                  # Biome check + tsc --noEmit (CI command)
pnpm check:fix              # Auto-fix Biome + type check
pnpm test                   # vitest --passWithNoTests
pnpm test:watch             # vitest watch
pnpm test:coverage          # vitest --coverage
pnpm lint                   # biome lint src
pnpm format                 # biome format --write .
pnpm type-check             # tsc --noEmit
pnpm dev                    # tsx watch dev server

# Run a single test file
pnpm vitest run src/tools/helpers/errors.test.ts

# Run a single test by name
pnpm vitest run -t "test name pattern"

# Mise shortcuts
mise run setup              # Full dev environment setup
mise run lint               # pnpm check
mise run test               # pnpm test
mise run fix                # pnpm check:fix
```

## Environment Variables

```bash
# Required: email credentials (App Passwords, NOT regular passwords)
EMAIL_CREDENTIALS=user@gmail.com:abcd-efgh-ijkl-mnop

# Multiple accounts
EMAIL_CREDENTIALS=user1@gmail.com:pass1,user2@outlook.com:pass2

# Custom IMAP host
EMAIL_CREDENTIALS=user@custom.com:password:imap.custom.com
```

## Code Style

### Formatting (Biome)

- **Indent**: 2 spaces
- **Line width**: 120
- **Quotes**: Single quotes
- **Semicolons**: As needed (omit when possible)
- **Trailing commas**: None
- **Arrow parens**: Always
- **Bracket spacing**: true
- **Line endings**: LF

### Imports

1. Type imports use `import type` (separate statement)
2. External packages first, then internal imports (relative paths)
3. Node builtins with `node:` prefix (`node:fs`, `node:path`, `node:url`)
4. **Always use `.js` extension** in import paths (ESM requirement)

```typescript
import type { AccountConfig } from '../helpers/config.js'
import { EmailMCPError, withErrorHandling } from '../helpers/errors.js'
import { searchEmails, readEmail } from '../helpers/imap-client.js'
```

### TypeScript

- `strict: true`, target: es2021, module: es2022, moduleResolution: Bundler
- `composite: true` for incremental builds
- `isolatedModules: true`, `forceConsistentCasingInFileNames: true`

### Naming Conventions

| Element              | Convention       | Example                            |
|----------------------|------------------|-------------------------------------|
| Functions/variables  | camelCase        | `registerTools`, `loadConfig`      |
| Interfaces           | PascalCase       | `MessagesInput`, `AccountConfig`   |
| Classes              | PascalCase       | `EmailMCPError`                    |
| Constants            | UPPER_SNAKE_CASE | `TOOLS`, `RESOURCES`, `DOCS_DIR`   |
| Files (helpers)      | kebab-case       | `init-server.ts`, `imap-client.ts` |
| Test files           | Co-located       | `errors.test.ts` next to `errors.ts` |

### Error Handling

- Custom `EmailMCPError` class: `message`, `code`, `suggestion`, `details`
- `withErrorHandling()` HOF wrapper for all composite tool functions
- `enhanceError()` converts raw errors to AI-friendly EmailMCPError
- `suggestFixes()` for AI-readable error recovery hints
- Error details sanitized to prevent secret/password leakage

### Biome Lint Rules

- `noExplicitAny`: **off** (email API responses use `any`)
- `noNonNullAssertion`: **off** (`!` assertion allowed)
- `noUnusedVariables`: warn
- `noUnusedImports`: error (via organizeImports)

### Architecture Pattern

- **Composite/Mega Tool**: Each domain (messages, folders, attachments, send) is one function
- Input: `{ action, ...params }`, dispatch via `switch(input.action)`
- Every composite tool exports: 1 async function + 1 interface
- Signature: `async function toolName(accounts: AccountConfig[], input: TypedInput): Promise<any>`
- Account resolution: filter by email, id, or partial match

### File Organization

```
src/
  init-server.ts              # Server entry point, env validation
  docs/                       # Markdown docs served as MCP resources
  tools/
    registry.ts               # Tool registration + routing
    composite/                 # One file per domain (messages, folders, attachments, send)
    helpers/                   # errors, config, html-utils, imap-client, smtp-client
```

### Documentation

- `/** */` JSDoc on every function
- File-level block comment describing module purpose
- No `@param`/`@returns` -- rely on TypeScript types

### Commits

Conventional Commits: `type(scope): message`. Enforced via git hooks.

### Pre-commit Hooks

1. `biome check --write` (lint + format)
2. `tsc --noEmit` (type check)
3. `pnpm test` (run tests)
