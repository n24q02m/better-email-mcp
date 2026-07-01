# CLAUDE.md - better-email-mcp

MCP Server cho Email (IMAP/SMTP). TypeScript, Node.js >= 24, bun, ESM.
5 composite tools, 21 actions (messages, folders, attachments, send, config) plus config__open_relay + help. Multi-account, App Passwords, auto-discovery.

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
  relay-setup.ts                 # formatCredentials() helper (relay form fields -> EMAIL_CREDENTIALS string)
  relay-schema.ts                # Relay form schema (email credential fields)
  credential-state.ts            # Single-user / stdio credential resolution from env
  auth/                          # Per-user credential store + Outlook OAuth (HTTP mode)
    in-memory-cred-store.ts      # LIVE per-user store: ephemeral in-memory, keyed by JWT sub
    outlook-device-code.ts       # Microsoft device-code OAuth flow
    subject-context.ts           # Per-request JWT-sub scope (AsyncLocalStorage)
  transports/
    http.ts                      # Multi-user HTTP transport with OAuth 2.1
  docs/                          # Markdown docs phuc vu qua MCP resources
  tools/
    registry.ts                  # Tool registration + routing
    composite/                   # 1 file per domain: messages, folders, attachments, send, config
    helpers/                     # errors, config, html-utils, imap-client, smtp-client
```

## Env vars

- **stdio mode** (default): `EMAIL_CREDENTIALS` (bat buoc). Format: `user@gmail.com:app-password`
  - Multi-account: `user1@gmail.com:pass1,user2@outlook.com:pass2`
  - Custom IMAP host: `user@custom.com:password:imap.custom.com`
  - Custom IMAP host + port: `user@custom.com:password:imap.custom.com:1993`
  - Local IMAP proxy: `user@custom.com:password:localhost:1993` (`localhost` accepted as host; per-account port)
- **http mode** (opt-in via `--http`, `MCP_TRANSPORT=http`, or `TRANSPORT_MODE=http`): `PUBLIC_URL` (for relay/OAuth redirect URLs). Per-user credentials are held in an in-memory store (`auth/in-memory-cred-store.ts`, keyed by JWT `sub`, cleared on restart). `MCP_AUTH_DISABLE=1` skips Bearer JWT verification (for deploys behind an external auth gateway).
- `PORT` (default `0` = OS-assigned random port), `HOST` (optional bind address)
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
- Secrets: skret SSM namespace `/better-email-mcp/prod` (region `ap-southeast-1`)

## Modes

Two transports, selected in `init-server.ts:52-53`. There is no `MCP_MODE` env var; the old `remote-relay` / `local-relay` distinction was removed (see `transports/http.ts:5`).

- **stdio (default)**: MCP SDK `StdioServerTransport` directly. Reads credentials from `EMAIL_CREDENTIALS` OR `EMAIL_USER` + `EMAIL_APP_PASSWORD`. Outlook accounts use an App Password in this mode.
- **http (opt-in)**: enabled via `--http`, `MCP_TRANSPORT=http`, or `TRANSPORT_MODE=http`. Single multi-user relay: `/authorize` form for App-Password providers (paste `email:app-password`) plus bundled Outlook device-code OAuth. Per-user credentials keyed by JWT `sub`. Outlook token file: `~/.better-email-mcp/tokens.json`. Deploy at `https://email.n24q02m.com`.

## Known bugs (phat hien 2026-04-18 E2E)

1. **(Obsolete)** Outlook Device Code "2 tab" duplicate auth — chỉ affect `local-relay` mode, đã bị gỡ cùng với `MCP_MODE` (xem mục Modes). HTTP mode hiện dùng mcp-core delegated device_code, không duplicate.

2. **(Obsolete)** Browser UI stuck "Waiting for server..." — chỉ affect `MCP_MODE=local-relay` (ECDH `relay/client.ts:sendMessage('complete')` paste-form flow), đã bị gỡ. Không còn relay-client path nào live trong HTTP mode.

3. **Config storage path**: stdio/single-user config ghi qua mcp-core `config-file.js` -> `config.enc` tại platformdirs `mcp` config dir (`$APPDATA\mcp\Config\config.enc` trên Windows; khac Python servers `$LOCALAPPDATA\mcp\config.enc`). Khi debug/test, clean ca 2 paths + `~/.better-email-mcp/tokens.json` de reset state.

4. **Outlook token email key**: `saveOutlookTokens` fallback to `OUTLOOK_EMAIL` env hoac `'outlook-device-code'` khi Microsoft token response khong include email field (device code mặc định không trả email). Workaround: set `OUTLOOK_EMAIL` env var khi self-host. Long-term fix: request `openid email profile` scopes + decode id_token trong onTokenReceived.

## E2E

Driven by `mcp-core/scripts/e2e/` (matrix-locked, 15 configs). Run a single config from this repo via `make e2e` (proxy) or directly:

```
cd ../mcp-core && uv run --project scripts/e2e python -m e2e.driver <config-id>
```

Configs for this repo: `email-gmail`, `email-outlook`.

``email-outlook`` is t2-interaction (Microsoft device-code, 900s timeout); user clicks ``microsoft.com/devicelogin``.

Tier policy:

- **T0** (precommit + CI on PR / main push) - runs without upstream identity. Skret keys not required.
- **T2 non-interaction** (`make e2e-config CONFIG=<id>` locally) - driver pre-fills relay form from skret AWS SSM `/better-email-mcp/prod` (`ap-southeast-1`). No user gate.
- **T2 interaction** - driver fills relay form, then prints upstream user-gate URL; user signs in / types OTP at provider. Driver enforces per-flow timeouts (device-code 900s, oauth-redirect 300s, browser-form 600s) and emits `[poll] elapsed=Xs remaining=Ys status=<body>` every 30s. On timeout, container logs + last `setup-status` are saved to `<tmp>/e2e-diag/` BEFORE teardown for post-mortem.

Multi-user remote mode (deployment property; not a separate config) keys per-user credentials by JWT `sub` in an in-memory store (`auth/in-memory-cred-store.ts`, TC-NearZK), cleared on restart — users re-submit after a restart.

References: `mcp-core/scripts/e2e/matrix.yaml`, `~/.claude/skills/mcp-dev/references/e2e-full-matrix.md` (harness-readiness gate), `~/.claude/skills/mcp-dev/references/secrets-skret.md` (per-server credential layout), `~/.claude/skills/mcp-dev/references/multi-user-pattern.md` (per-JWT-sub isolation).
