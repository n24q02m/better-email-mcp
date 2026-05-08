# Better Email MCP

mcp-name: io.github.n24q02m/better-email-mcp

**IMAP/SMTP email server for AI agents -- 6 composite tools with multi-account and auto-discovery**

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
| [better-code-review-graph](https://github.com/n24q02m/better-code-review-graph) | Knowledge graph for token-efficient code reviews -- fixed search, configurabl... | MCP |
| [better-email-mcp](https://github.com/n24q02m/better-email-mcp) | IMAP/SMTP email server for AI agents -- 6 composite tools with multi-account ... | MCP |
| [better-godot-mcp](https://github.com/n24q02m/better-godot-mcp) | Composite MCP server for Godot Engine -- 17 mega-tools for AI-assisted game d... | MCP |
| [better-notion-mcp](https://github.com/n24q02m/better-notion-mcp) | Markdown-first Notion API server for AI agents -- 10 composite tools replacin... | MCP |
| [better-telegram-mcp](https://github.com/n24q02m/better-telegram-mcp) | MCP server for Telegram with dual-mode support: Bot API (httpx) for quick bot... | MCP |
| [claude-plugins](https://github.com/n24q02m/claude-plugins) | Full documentation: mcp.n24q02m.com — unified docs for all 8 servers + the mc... | Marketplace |
| [imagine-mcp](https://github.com/n24q02m/imagine-mcp) | Production-grade MCP server for image and video understanding + generation ac... | MCP |
| [jules-task-archiver](https://github.com/n24q02m/jules-task-archiver) | Chrome Extension for bulk operations on Jules tasks via batchexecute API -- a... | Tooling |
| [mcp-core](https://github.com/n24q02m/mcp-core) | Unified MCP Streamable HTTP 2025-11-25 transport, OAuth 2.1 Authorization Ser... | MCP |
| [mnemo-mcp](https://github.com/n24q02m/mnemo-mcp) | Persistent AI memory with hybrid search and embedded sync. Open, free, unlimi... | MCP |
| [qwen3-embed](https://github.com/n24q02m/qwen3-embed) | Lightweight Qwen3 text embedding and reranking via ONNX Runtime and GGUF | Library |
| [skret](https://github.com/n24q02m/skret) | Secrets without the server. | CLI |
| [web-core](https://github.com/n24q02m/web-core) | Shared web infrastructure package for search, scraping, HTTP security, and st... | Library |
| [wet-mcp](https://github.com/n24q02m/wet-mcp) | Open-source MCP Server for web search, content extraction, library docs & mul... | MCP |

</details>
<!-- END: AUTO-GENERATED-CROSS-PROMO -->

## Table of contents

- [Features](#features)
- [Status](#status)
- [Documentation](#documentation)
- [Tools](#tools)
- [Remote (HTTP Mode)](#remote-http-mode)
- [Outlook OAuth Device Code (HTTP mode)](#outlook-oauth-device-code-http-mode)
- [Configuration](#configuration)
- [Security](#security)
- [Build from Source](#build-from-source)
- [Trust Model](#trust-model)
- [License](#license)



<a href="https://glama.ai/mcp/servers/n24q02m/better-email-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/n24q02m/better-email-mcp/badge" alt="Better Email MCP server" />
</a>

## Features

- **Multi-account support** -- manage 6+ email accounts (Gmail, Outlook, Yahoo, iCloud, Zoho, ProtonMail, custom IMAP)
- **App Passwords** -- no OAuth2 setup required for most providers; clone and run in 1 minute
- **6 composite tools** with 20 actions -- search, read, send, reply, forward, organize, credential setup in single calls
- **Auto-discovery** -- provider settings detected from email address, custom IMAP host supported
- **Thread-aware** -- reply/forward maintains In-Reply-To and References headers
- **Tiered token optimization** -- compressed descriptions + on-demand `help` tool + MCP Resources

## Status

> **2026-05-02 -- Architecture stabilization update**
>
> Past months saw significant churn around credential handling and the daemon-bridge auto-spawn pattern. This caused multi-process races, browser tab spam, and inconsistent setup UX across plugins. **As of v&lt;auto&gt;, the architecture is stable**: 2 clean modes (stdio + HTTP), no daemon-bridge layer, no auto-spawn from stdio.
>
> Apologies for the instability period. If you encountered issues with prior versions, please update to v&lt;auto&gt;+ and follow the current [`docs/setup-manual.md`](docs/setup-manual.md) -- most prior workarounds are no longer needed.
>
> **Related plugins from the same author**:
> - [wet-mcp](https://github.com/n24q02m/wet-mcp) -- Web search + content extraction
> - [mnemo-mcp](https://github.com/n24q02m/mnemo-mcp) -- Persistent AI memory
> - [imagine-mcp](https://github.com/n24q02m/imagine-mcp) -- Image/video understanding + generation
> - [better-notion-mcp](https://github.com/n24q02m/better-notion-mcp) -- Notion API
> - [better-email-mcp](https://github.com/n24q02m/better-email-mcp) -- Email management
> - [better-telegram-mcp](https://github.com/n24q02m/better-telegram-mcp) -- Telegram
> - [better-godot-mcp](https://github.com/n24q02m/better-godot-mcp) -- Godot Engine
> - [better-code-review-graph](https://github.com/n24q02m/better-code-review-graph) -- Code review knowledge graph
>
> All plugins share the same architecture -- install once, learn pattern transfers.

## Documentation

Full docs at **[mcp.n24q02m.com/servers/better-email-mcp/](https://mcp.n24q02m.com/servers/better-email-mcp/)**:

- [Setup](https://mcp.n24q02m.com/servers/better-email-mcp/setup/) -- install methods for Claude Code, Codex, Gemini CLI, Cursor, Windsurf, mcp.json
- [Modes overview](https://mcp.n24q02m.com/get-started/modes-overview/) -- stdio / local-relay / remote-relay / remote-oauth
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
| `setup` | `status`, `start`, `reset`, `complete` | Credential setup via browser relay, status check, reset, re-resolve |
| `help` | - | Get full documentation for any tool |

### MCP Resources

| URI | Description |
|:----|:------------|
| `email://docs/messages` | Message operations reference |
| `email://docs/folders` | Folder operations reference |
| `email://docs/attachments` | Attachment operations reference |
| `email://docs/send` | Send/compose reference |
| `email://docs/help` | Full documentation |

## Remote (HTTP Mode)

Run as a multi-user HTTP server with OAuth 2.1 authentication:

```jsonc
{
  "mcpServers": {
    "better-email": {
      "type": "http",
      "url": "https://better-email-mcp.n24q02m.com/mcp"
    }
  }
}
```

### Self-Hosting (HTTP Mode)

Single multi-user mode (relay form for App-Password providers + bundled Outlook OAuth device-code):

```bash
docker run -p 8080:8080 \
  -e PUBLIC_URL=https://your-domain.com \
  -e DCR_SERVER_SECRET=$(openssl rand -hex 32) \
  n24q02m/better-email-mcp:latest
```

Users provide their own email credentials through the OAuth flow / paste form. No server-side `EMAIL_CREDENTIALS` needed. Outlook OAuth uses the bundled public Azure client (`d56f8c71-9f7c-43f4-9934-be29cb6e77b0`, Thunderbird-pattern) -- no user-side Azure app registration needed.

## Outlook OAuth Device Code (HTTP mode)

In HTTP mode, Outlook/Hotmail/Live accounts use OAuth2 device-code automatically. On first use:

1. The server prints a device code and a Microsoft login URL
2. Open the URL in a browser and enter the code
3. Sign in and authorize the app
4. Tokens are persisted per JWT sub (`tokens/<sub>.json`)

OAuth uses the bundled public Azure client (`d56f8c71-9f7c-43f4-9934-be29cb6e77b0`, Thunderbird-pattern) -- no user-side Azure registration needed.

In **stdio mode**, Outlook accounts use an **App Password** instead (Outlook Account Settings → Security → Advanced security options → App passwords).

## Configuration

| Variable | Required | Default | Description |
|:---------|:---------|:--------|:------------|
| `EMAIL_PROVIDER` | Yes (stdio, single-account) | - | Provider key: `gmail`, `outlook`, `yahoo`, `icloud`, `zoho`, `custom` |
| `EMAIL_USER` | Yes (stdio, single-account) | - | Email address |
| `EMAIL_APP_PASSWORD` | Yes (stdio, single-account) | - | App password (Gmail/Yahoo/iCloud) or Outlook App Password |
| `EMAIL_IMAP_HOST` | No (custom only) | - | Custom IMAP hostname when `EMAIL_PROVIDER=custom` |
| `EMAIL_CREDENTIALS` | Alternative (multi-account) | - | Legacy `user@gmail.com:app-password` (comma-separated for multi-account) |
| `PUBLIC_URL` | Yes (http) | - | Server's public URL for OAuth redirects |
| `DCR_SERVER_SECRET` | Yes (http) | - | HMAC secret for stateless client registration |
| `PORT` | No | `8080` | Server port (http mode) |
| `OUTLOOK_CLIENT_ID` | No | `d56f8c71-9f7c-43f4-9934-be29cb6e77b0` (bundled public client) | Override the bundled Azure AD public client for self-hosted Outlook OAuth2 |
| `OUTLOOK_EMAIL` | No | - | Workaround when Microsoft device-code response omits the email field |

### Multiple Accounts

```bash
EMAIL_CREDENTIALS=user1@gmail.com:pass1,user2@outlook.com:pass2,user3@yahoo.com:pass3
```

### Custom IMAP Host

```bash
EMAIL_CREDENTIALS=user@custom.com:password:imap.custom.com
```

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

## Trust Model

This plugin implements **TC-NearZK** (in-memory, ephemeral). See [mcp-core/docs/TRUST-MODEL.md](https://github.com/n24q02m/mcp-core/blob/main/docs/TRUST-MODEL.md) for full classification.

| Mode | Storage | Encryption | Who can read your data? |
|---|---|---|---|
| HTTP n24q02m-hosted (default) | In-memory `Map<sub, OAuthToken>` | In-process only | Server process (cleared on restart) |
| HTTP self-host | Same as hosted | Same | Only you (admin = user) |
| stdio proxy | `~/.better-email-mcp/config.json` | AES-GCM, machine-bound key | Only your OS user (file perm 0600) |

## License

MIT -- See [LICENSE](LICENSE).
