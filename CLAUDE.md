# CLAUDE.md - better-email-mcp

MCP Server cho Email (IMAP/SMTP). TypeScript, Node.js >= 24, bun, ESM.
5 composite tools, 15 actions. Multi-account, App Passwords, auto-discovery.

## Commands

```bash
# Setup
bun install

# Lint & Type check
bun run check                    # biome check + tsc --noEmit
bun run type-check               # tsc --noEmit only

# Fix
bun run check:fix                # biome fix + type check

# Test
bun run test                     # vitest (--passWithNoTests)
bun run test:watch               # vitest watch
bun run test:coverage            # vitest --coverage
bun vitest run src/tools/helpers/errors.test.ts   # single file

# Build & Dev
bun run build                    # tsc --build tsconfig.build.json + esbuild CLI
bun run dev                      # tsx watch dev server

# Docker
bun run docker:build
bun run docker:run

# Mise shortcuts
mise run setup     # full dev setup
mise run lint      # bun run check
mise run test      # bun run test
mise run fix       # bun run check:fix
```

## Cau truc thu muc

```
src/
  init-server.ts                 # Entry point, env validation
  relay-setup.ts                 # Zero-config relay: create session, poll for config
  relay-schema.ts                # Relay form schema (email credential fields)
  auth/                          # OAuth 2.1 + DCR, per-user credential store
    stateless-client-store.ts    # HMAC-based stateless DCR (shared with Notion MCP)
    email-auth-provider.ts       # OAuthServerProvider for multi-user HTTP mode
    per-user-credential-store.ts # AES-256-GCM encrypted per-user credential storage
  transports/
    http.ts                      # Multi-user HTTP transport with OAuth 2.1
    credential-store.ts          # Single-user encrypted credential store (stdio mode)
  docs/                          # Markdown docs phuc vu qua MCP resources
  tools/
    registry.ts                  # Tool registration + routing
    composite/                   # 1 file per domain: messages, folders, attachments, send
    helpers/                     # errors, config, html-utils, imap-client, smtp-client
```

## Env vars

- **stdio mode** (default): `EMAIL_CREDENTIALS` (bat buoc). Format: `user@gmail.com:app-password`
  - Multi-account: `user1@gmail.com:pass1,user2@outlook.com:pass2`
  - Custom IMAP host: `user@custom.com:password:imap.custom.com`
- **http mode**: `TRANSPORT_MODE=http`, `PUBLIC_URL`, `DCR_SERVER_SECRET`
- `PORT` (default 8080)
- `OUTLOOK_CLIENT_ID` -- tu chon, cho self-hosted OAuth2 client

## Code conventions

- Biome: 2 spaces, 120 line width, single quotes, semicolons as needed, trailing commas none
- Import: `import type` rieng, `.js` extension bat buoc, `node:` prefix cho builtins
- tsconfig: `strict: true`, target es2021, module es2022, moduleResolution Bundler
- Error: `EmailMCPError` + `withErrorHandling()` HOF. `enhanceError()` + `suggestFixes()`.
- Error details duoc sanitize de tranh lo secrets/passwords.
- Test files co-located: `errors.test.ts` canh `errors.ts`
- `noExplicitAny`: off (email API responses dung `any`)

## CD Pipeline

PSR v10 (workflow_dispatch) -> npm + Docker (amd64+arm64) + GHCR + MCP Registry.

## Luu y

- Outlook/Hotmail/Live dung OAuth2 tu dong (Device Code flow). Token luu tai `~/.better-email-mcp/tokens.json`.
- Gmail, Yahoo, iCloud: dung App Passwords, KHONG phai password thuong.
- Account resolution: filter theo email, id, hoac partial match.
- Composite tool signature: `async function toolName(accounts: AccountConfig[], input: TypedInput): Promise<any>`
- 3-tier token optimization: Tier 1 (compact), Tier 2 (help tool), Tier 3 (MCP Resources).
- Pre-commit: biome check --write, tsc --noEmit, bun run test.
- Infisical project: `3f23a1cb-d966-448d-91a1-bd1566a2361c`
