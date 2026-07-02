# Better Email MCP

mcp-name: io.github.n24q02m/better-email-mcp

**IMAP/SMTP email for AI agents -- read, send, organize folders, and manage attachments across multiple accounts, with auto-discovery.**

<!-- Badge Row 1: Status -->
[![CI](https://github.com/n24q02m/better-email-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/n24q02m/better-email-mcp/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/n24q02m/better-email-mcp/graph/badge.svg?token=O2GWBWCZGF)](https://codecov.io/gh/n24q02m/better-email-mcp)
[![npm](https://img.shields.io/npm/v/@n24q02m/better-email-mcp?logo=npm&logoColor=white)](https://www.npmjs.com/package/@n24q02m/better-email-mcp)
[![Docker](https://img.shields.io/docker/v/n24q02m/better-email-mcp?label=docker&logo=docker&logoColor=white&sort=semver)](https://hub.docker.com/r/n24q02m/better-email-mcp)
[![License: MIT](https://img.shields.io/github/license/n24q02m/better-email-mcp)](LICENSE)

<!-- Badge Row 2: Tech -->
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](#)
[![Node.js](https://img.shields.io/badge/Node.js-5FA04E?logo=nodedotjs&logoColor=white)](#)
[![IMAP/SMTP](https://img.shields.io/badge/IMAP%2FSMTP-005FF9?logo=maildotru&logoColor=white)](#)
[![semantic-release](https://img.shields.io/badge/semantic--release-e10079?logo=semantic-release&logoColor=white)](https://github.com/python-semantic-release/python-semantic-release)
[![Renovate](https://img.shields.io/badge/renovate-enabled-1A1F6C?logo=renovatebot&logoColor=white)](https://developer.mend.io/)

<!-- BEGIN: AUTO-GENERATED-CROSS-PROMO -->
<details>
  <summary><strong>Sister projects from n24q02m</strong> (click to expand)</summary>

| Project | Tagline | Tag |
|---|---|---|
| [better-code-review-graph](https://github.com/n24q02m/better-code-review-graph) | Knowledge graph for token-efficient code reviews -- semantic search and call-... | MCP |
| [better-email-mcp](https://github.com/n24q02m/better-email-mcp) | IMAP/SMTP email for AI agents -- read, send, organize folders, and manage att... | MCP |
| [better-godot-mcp](https://github.com/n24q02m/better-godot-mcp) | Composite MCP server for Godot Engine -- 17 composite tools for AI-assisted g... | MCP |
| [better-notion-mcp](https://github.com/n24q02m/better-notion-mcp) | Markdown-first Notion for AI agents -- pages, databases, blocks, and comments... | MCP |
| [better-telegram-mcp](https://github.com/n24q02m/better-telegram-mcp) | Telegram for AI agents -- messages, chats, media, and contacts across both bo... | MCP |
| [claude-plugins](https://github.com/n24q02m/claude-plugins) | Claude Code plugin marketplace for the n24q02m MCP servers -- install web sea... | Marketplace |
| [imagine-mcp](https://github.com/n24q02m/imagine-mcp) | Image and video understanding + generation for AI agents -- across Gemini, Op... | MCP |
| [jules-task-archiver](https://github.com/n24q02m/jules-task-archiver) | Chrome Extension for bulk operations on Jules tasks via batchexecute API -- a... | Tooling |
| [mcp-core](https://github.com/n24q02m/mcp-core) | Shared foundation for building MCP servers -- Streamable HTTP transport, OAut... | MCP |
| [mnemo-mcp](https://github.com/n24q02m/mnemo-mcp) | Persistent AI memory with hybrid search and embedded sync. Open, free, unlimi... | MCP |
| [qwen3-embed](https://github.com/n24q02m/qwen3-embed) | Lightweight Qwen3 text embedding and reranking via ONNX Runtime and GGUF | Library |
| [skret](https://github.com/n24q02m/skret) | Secrets without the server. | CLI |
| [tacet](https://github.com/n24q02m/tacet) | TACET: a self-distilling neuro-symbolic cascade that amortises LLM cost in kn... | Tooling |
| [web-core](https://github.com/n24q02m/web-core) | Shared web infrastructure package for search, scraping, HTTP security, and st... | Library |
| [wet-mcp](https://github.com/n24q02m/wet-mcp) | Open-source MCP server for AI agents: web search, content extraction, and lib... | MCP |

</details>
<!-- END: AUTO-GENERATED-CROSS-PROMO -->

## Table of contents

- [Features](#features)
- [Install](#install)
- [Documentation](#documentation)
- [Tools](#tools)
- [Comparison](#comparison)
- [Remote (HTTP Mode)](#remote-http-mode)
- [Outlook OAuth Device Code (HTTP mode)](#outlook-oauth-device-code-http-mode)
- [Configuration](#configuration)
- [Security](#security)
- [Build from Source](#build-from-source)
- [Deploy to Cloudflare](#deploy-to-cloudflare)
- [Trust Model](#trust-model)
- [License](#license)



<a href="https://glama.ai/mcp/servers/n24q02m/better-email-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/n24q02m/better-email-mcp/badge" alt="Better Email MCP server" />
</a>

## Features

- **Multi-account support** -- manage 6+ email accounts (Gmail, Outlook, Yahoo, iCloud, Zoho, ProtonMail, custom IMAP)
- **App Passwords** -- no OAuth2 setup required for most providers; clone and run in 1 minute
- **5 composite tools** with 21 actions (plus `help` + `config__open_relay`) -- search, read, send, reply, forward, organize, and credential setup in single calls
- **Auto-discovery** -- provider settings detected from email address, custom IMAP host supported
- **Thread-aware** -- reply/forward maintains In-Reply-To and References headers
- **Tiered token optimization** -- compressed descriptions + on-demand `help` tool + MCP Resources

## Install

The server runs in two modes: **stdio** (default, single-user, credentials from env vars) and **HTTP** (opt-in, multi-user with OAuth 2.1). For stdio, add it to your MCP client config:

```jsonc
{
  "mcpServers": {
    "better-email": {
      "command": "npx",
      "args": ["--yes", "@n24q02m/better-email-mcp@latest"],
      "env": {
        "EMAIL_CREDENTIALS": "user@gmail.com:app-password"
      }
    }
  }
}
```

Multiple accounts are comma-separated: `user1@gmail.com:pass1,user2@outlook.com:pass2`. See [Configuration](#configuration) for all env vars, and [Remote (HTTP Mode)](#remote-http-mode) to run a hosted multi-user server.

Most providers use an **App Password** (no OAuth setup); Outlook/Hotmail/Live use a bundled OAuth device-code flow in HTTP mode. Settings (IMAP/SMTP host, port) are auto-discovered from the email domain.

## Documentation

Full docs at **[mcp.n24q02m.com/servers/better-email-mcp/setup/](https://mcp.n24q02m.com/servers/better-email-mcp/setup/)**:

- [Setup](https://mcp.n24q02m.com/servers/better-email-mcp/setup/) -- install methods for Claude Code, Codex, Gemini CLI, Cursor, Windsurf, mcp.json
- [Modes overview](https://mcp.n24q02m.com/get-started/modes-overview/) -- stdio (default) and HTTP (opt-in, multi-user with OAuth 2.1)
- [Multi-user setup](https://mcp.n24q02m.com/get-started/multi-user/) -- per-JWT-sub credential model

**Install with AI agent** -- paste this to your AI coding agent:

> Install MCP server `better-email-mcp` following the steps at
> https://raw.githubusercontent.com/n24q02m/claude-plugins/main/plugins/better-email-mcp/setup-with-agent.md

## Tools

| Tool | Actions | Description |
|:-----|:--------|:------------|
| `messages` | `search`, `read`, `mark_read`, `mark_unread`, `flag`, `unflag`, `move`, `archive`, `trash` | Search, read, and organize emails |
| `folders` | `list` | List mailbox folders |
| `attachments` | `list`, `download` | List and download email attachments |
| `send` | `new`, `reply`, `forward` | Compose, reply, and forward emails |
| `config` | `status`, `setup_start`, `setup_reset`, `setup_complete`, `set`, `cache_clear` | Credential setup via browser relay, status check, reset, re-resolve, cache clear |
| `config__open_relay` | - | Open the relay configuration form in the browser and return the relay URL |
| `help` | - | Get full documentation for any tool |

### MCP Resources

| URI | Description |
|:----|:------------|
| `email://docs/messages` | Message operations reference |
| `email://docs/folders` | Folder operations reference |
| `email://docs/attachments` | Attachment operations reference |
| `email://docs/send` | Send/compose reference |
| `email://docs/config` | Credential setup and runtime configuration reference |
| `email://docs/help` | Full documentation |

## Comparison

How better-email-mcp stacks up against direct competitors in each pillar:

| Capability | better-email-mcp | [email-mcp](https://github.com/codefuturist/email-mcp) | [Gmail-MCP-Server](https://github.com/GongRzhe/Gmail-MCP-Server) | [mcp-mail-server](https://github.com/yunfeizhu/mcp-mail-server) |
|---|---|---|---|---|
| IMAP/SMTP (provider-agnostic) | Yes | Yes | No (Gmail API only) | Yes |
| Multi-account | Yes (comma-separated creds) | Yes | No (single global credential) | No (single account per instance) |
| App Passwords | Yes (no OAuth setup) | Yes | No (OAuth2 only) | Yes |
| Auto-discovery from email address | Yes | Yes (8 providers) | n/a (Gmail only) | No (manual host/port) |
| Bundled Outlook OAuth (no user Azure app) | Yes (device-code, Thunderbird-pattern client) | partial (OAuth2 XOAUTH2, experimental) | No (user-supplied Google OAuth) | No |
| Attachments (list + download) | Yes | Yes | Yes | Yes |
| HTTP multi-user mode (per-JWT-sub) | Yes (OAuth 2.1, self-hostable) | No (stdio only) | No (stdio only) | No (stdio only) |

## Remote (HTTP Mode)

Run as a multi-user HTTP server with OAuth 2.1 authentication:

```jsonc
{
  "mcpServers": {
    "better-email": {
      "type": "http",
      "url": "https://email.n24q02m.com/mcp"
    }
  }
}
```

### Self-Hosting (HTTP Mode)

Single multi-user mode (relay form for App-Password providers + bundled Outlook OAuth device-code):

```bash
docker run -p 8080:8080 \
  -e PORT=8080 \
  -e PUBLIC_URL=https://your-domain.com \
  n24q02m/better-email-mcp:latest
```

Users provide their own email credentials through the OAuth flow / paste form. No server-side `EMAIL_CREDENTIALS` needed. With the default Docker self-host, per-user credentials are held in an in-memory store (cleared on restart); users re-submit after a restart. Outlook OAuth uses the bundled public Azure client (`d56f8c71-9f7c-43f4-9934-be29cb6e77b0`, Thunderbird-pattern) -- no user-side Azure app registration needed.

### Cloudflare serverless mode (KV-only)

Deploy a per-user serverless instance at `https://email.n24q02m.com`: each JWT `sub`
gets its own Container Durable Object, and all credentials AND Outlook OAuth tokens are
AES-256-GCM encrypted into Workers KV (one `subs/<sub>/config` blob per user) so they
**survive scale-to-zero / container recreate with no re-auth**. The JWT signing key is
derived deterministically from `CREDENTIAL_SECRET` (EdDSA), so the user's identity is
stable across recreate. Required secrets: `CREDENTIAL_SECRET` (per-sub vault + EdDSA),
`MCP_RELAY_PASSWORD` (form gate), `MCP_DCR_SERVER_SECRET` (intentional multi-user
deploy). See `wrangler.jsonc`.

> Keying Outlook tokens by JWT `sub` (in the per-sub KV blob) resolves the former
> email-keyed `tokens.json` ambiguity (CLAUDE.md Known Bug #4): two users' Outlook
> accounts can no longer collide.

> Caveat: `localhost` IMAP accounts (`email:pass:localhost:1993`) are valid for
> local / VM deployments but CANNOT work on Cloudflare — there is no co-located IMAP
> proxy inside the container. Use a publicly-reachable IMAP host on CF.

## Outlook OAuth Device Code (HTTP mode)

In HTTP mode, Outlook/Hotmail/Live accounts use OAuth2 device-code automatically. On first use:

1. The server prints a device code and a Microsoft login URL
2. Open the URL in a browser and enter the code
3. Sign in and authorize the app
4. Tokens are persisted per JWT sub — in the encrypted Cloudflare KV credential blob (`subs/<sub>/config`) on the serverless deploy, or in `~/.better-email-mcp/tokens.json` for single-user / stdio

OAuth uses the bundled public Azure client (`d56f8c71-9f7c-43f4-9934-be29cb6e77b0`, Thunderbird-pattern) -- no user-side Azure registration needed.

In **stdio mode**, Outlook accounts use an **App Password** instead (Outlook Account Settings → Security → Advanced security options → App passwords).

## Configuration

| Variable | Required | Default | Description |
|:---------|:---------|:--------|:------------|
| `EMAIL_CREDENTIALS` | Yes (stdio) | - | Email credentials, `email:app-password` per account, comma-separated for multi-account. Optional custom IMAP host/port: `email:password:imap_host:imap_port` |
| `EMAIL_USER` | Alternative (stdio, single-account) | - | Email address. Used with `EMAIL_APP_PASSWORD` as a per-field alternative to `EMAIL_CREDENTIALS`; merged into `EMAIL_CREDENTIALS` at boot |
| `EMAIL_APP_PASSWORD` | Alternative (stdio, single-account) | - | App password (Gmail/Yahoo/iCloud) or Outlook App Password; used with `EMAIL_USER` |
| `PUBLIC_URL` | No (http) | - | Server's public URL for relay / OAuth redirect links |
| `PORT` | No | `0` (OS-assigned) | Server port (http mode); set explicitly (e.g. `8080`) to bind a fixed port |
| `HOST` | No | - | Bind address (http mode) |
| `MCP_AUTH_DISABLE` | No (http) | - | Set to `1` to skip Bearer JWT verification when behind an external auth gateway |
| `OUTLOOK_CLIENT_ID` | No | `d56f8c71-9f7c-43f4-9934-be29cb6e77b0` (bundled public client) | Override the bundled Azure AD public client for self-hosted Outlook OAuth2 |
| `OUTLOOK_EMAIL` | No | - | Workaround when Microsoft device-code response omits the email field |

### Multiple Accounts

```bash
EMAIL_CREDENTIALS=user1@gmail.com:pass1,user2@outlook.com:pass2,user3@yahoo.com:pass3
```

### Custom IMAP Host

```bash
# Custom hostname (default port 993, implicit TLS)
EMAIL_CREDENTIALS=user@custom.com:password:imap.custom.com

# Custom hostname with a custom port
EMAIL_CREDENTIALS=user@custom.com:password:imap.custom.com:1993

# Local IMAP proxy -- "localhost" is accepted as a host, even without a dot
EMAIL_CREDENTIALS=user@custom.com:password:localhost:1993
```

Each account can use its own host and port. A non-993 port is treated as
plaintext/STARTTLS -- the usual shape for a local IMAP proxy (for example
[email-oauth2-proxy](https://github.com/simonrob/email-oauth2-proxy)).

### Search Query Language

| Query | Description |
|:------|:------------|
| `UNREAD` | Unread emails |
| `FLAGGED` | Starred emails |
| `SINCE 2024-01-01` | Emails after date |
| `FROM boss@company.com` | Emails from sender |
| `SUBJECT meeting` | Emails matching subject |
| `UNREAD SINCE 2024-06-01` | Compound filter |

### Supported Providers

| Provider | Auth | Save-to-Sent |
|:---------|:-----|:-------------|
| Gmail | App Password | Auto (skipped) |
| Yahoo | App Password | Auto (skipped) |
| iCloud/Me.com | App-Specific Password | Auto (skipped) |
| Outlook/Hotmail/Live | OAuth2 (Device Code) | IMAP APPEND |
| Zoho | App Password | IMAP APPEND |
| ProtonMail | ProtonMail Bridge | IMAP APPEND |
| Custom | Via `email:pass:imap.host` | IMAP APPEND |

## Security

- **Credential sanitization** -- Passwords never leaked in error messages
- **App Passwords** -- Uses app-specific passwords, not regular passwords
- **Token storage** -- Outlook OAuth tokens saved with 600 permissions
- **IMAP validation** -- Search queries validated before execution

## Build from Source

```bash
git clone https://github.com/n24q02m/better-email-mcp.git
cd better-email-mcp
bun install
bun run dev
```

## Deploy to Cloudflare

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/n24q02m/better-email-mcp)

Run your own multi-user better-email instance serverless on Cloudflare (Containers + KV).
Each JWT `sub` gets its own Container Durable Object, and every user's email credentials and
Outlook OAuth tokens are AES-256-GCM encrypted into a single Workers KV blob per user, so they
survive scale-to-zero / container recreate with no re-auth.

**Prerequisites:** a Cloudflare account on the **Workers Paid plan** — required for Containers (the Cloudflare free tier does not include Containers) — and the `wrangler` CLI.

1. `git clone https://github.com/n24q02m/better-email-mcp && cd better-email-mcp`
2. `wrangler login`
3. Create the KV namespace (better-email is KV-only -- no D1 / Vectorize):
   ```
   wrangler kv namespace create better-email-kv
   ```
   Paste the returned id into `<better-email-kv-namespace-id>` in `wrangler.jsonc`.
4. Push the container image to your Cloudflare managed registry (CF Containers cannot pull
   from external registries directly), then set `<YOUR_ACCOUNT_ID>` in `wrangler.jsonc`:
   ```
   docker pull ghcr.io/n24q02m/better-email-mcp:beta
   docker tag ghcr.io/n24q02m/better-email-mcp:beta better-email-mcp:beta
   wrangler containers push better-email-mcp:beta   # prints registry.cloudflare.com/<ACCOUNT_ID>/better-email-mcp:beta
   ```
5. Point `wrangler.jsonc` at your own domain: set `<YOUR_PUBLIC_URL>` (e.g.
   `https://email.example.com`) and `<YOUR_WORKER_DOMAIN>` (e.g. `email.example.com`).
6. Set the deploy secrets:
   ```
   wrangler secret put CREDENTIAL_SECRET      # per-sub vault key + deterministic EdDSA signing (required)
   wrangler secret put MCP_RELAY_PASSWORD     # gate for the /authorize setup form
   wrangler secret put MCP_DCR_SERVER_SECRET  # proof of an intentional multi-user deploy
   ```
   Optional Outlook overrides -- only to replace the bundled public Azure device-code client
   (default needs no user-side Azure app): `wrangler secret put OUTLOOK_CLIENT_ID` and
   `wrangler secret put OUTLOOK_EMAIL`.
7. `wrangler deploy`, then open `<YOUR_PUBLIC_URL>/authorize` and complete the browser relay form.

End-users supply their own email credentials -- an App Password via the paste form, or the
bundled Outlook device-code sign-in -- through that relay form; there is no server-side
`EMAIL_CREDENTIALS`. Storage maps to Cloudflare via `MCP_STORAGE_BACKEND=cf-kv` (already set in
`wrangler.jsonc`); see [Cloudflare serverless mode (KV-only)](#cloudflare-serverless-mode-kv-only)
for the encryption and trust details.

## Trust Model

This plugin implements **TC-NearZK** (in-memory, ephemeral). See the [mcp-core trust model](https://mcp.n24q02m.com/servers/mcp-core/trust-model/) for full classification.

| Mode | Storage | Encryption | Who can read your data? |
|---|---|---|---|
| HTTP remote (hosted) | In-memory `Map<sub, OAuthToken>` | In-process only | Server process (cleared on restart) |
| HTTP self-host | Same as hosted | Same | Only you (admin = user) |
| stdio | platformdirs `mcp` config dir (`config.enc`; e.g. `%APPDATA%\mcp\Config\config.enc` on Windows) | AES-GCM, machine-bound key | Only your OS user (file perm 0600) |

## License

MIT -- See [LICENSE](LICENSE).
