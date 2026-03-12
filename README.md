# Better Email MCP

**IMAP/SMTP MCP Server for Email - Optimized for AI Agents**

[![CI](https://github.com/n24q02m/better-email-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/n24q02m/better-email-mcp/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/n24q02m/better-email-mcp/graph/badge.svg?token=O2GWBWCZGF)](https://codecov.io/gh/n24q02m/better-email-mcp)
[![npm](https://img.shields.io/npm/v/@n24q02m/better-email-mcp?logo=npm&logoColor=white)](https://www.npmjs.com/package/@n24q02m/better-email-mcp)
[![Docker](https://img.shields.io/docker/v/n24q02m/better-email-mcp?label=docker&logo=docker&logoColor=white&sort=semver)](https://hub.docker.com/r/n24q02m/better-email-mcp)
[![License: MIT](https://img.shields.io/github/license/n24q02m/better-email-mcp)](LICENSE)

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](#)
[![Node.js](https://img.shields.io/badge/Node.js-5FA04E?logo=nodedotjs&logoColor=white)](#)
[![IMAP/SMTP](https://img.shields.io/badge/IMAP%2FSMTP-005FF9?logo=maildotru&logoColor=white)](#)
[![semantic-release](https://img.shields.io/badge/semantic--release-e10079?logo=semantic-release&logoColor=white)](https://github.com/python-semantic-release/python-semantic-release)
[![Renovate](https://img.shields.io/badge/renovate-enabled-1A1F6C?logo=renovatebot&logoColor=white)](https://developer.mend.io/)

<a href="https://glama.ai/mcp/servers/n24q02m/better-email-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/n24q02m/better-email-mcp/badge" alt="better-email-mcp MCP server" />
</a>

## Why "Better"?

**5 composite tools** that provide full email operations (search, read, send, reply, forward, organize) across multiple accounts using IMAP/SMTP with App Passwords.

### Key Features

| Feature | Description |
|---------|-------------|
| **Multi-Account** | Manage 6+ email accounts simultaneously |
| **App Passwords** | No OAuth2 setup required - clone and run in 1 minute |
| **Auto-Discovery** | Gmail, Outlook, Yahoo, iCloud, Zoho, ProtonMail auto-configured |
| **Clean Text** | HTML stripped for LLM token savings |
| **Thread Support** | Reply/forward maintains In-Reply-To and References headers |
| **Composite Tools** | 5 tools with 15 actions (not 15+ separate endpoints) |

---

## Quick Start

### Prerequisites

Create App Passwords (NOT your regular password):
- **Gmail**: Enable 2FA, then <https://myaccount.google.com/apppasswords>
- **Yahoo**: Enable 2FA, then <https://login.yahoo.com/account/security/app-passwords>
- **iCloud**: <https://appleid.apple.com> > Sign-In and Security > App-Specific Passwords
- **Outlook/Hotmail/Live**: OAuth2 built-in (server guides you on first use)

### Option 1: Package Manager (Recommended)

```jsonc
{
  "mcpServers": {
    "better-email": {
      "command": "bun",
      "args": ["x", "@n24q02m/better-email-mcp@latest"],
      "env": {
        "EMAIL_CREDENTIALS": "user@gmail.com:abcd-efgh-ijkl-mnop"
      }
    }
  }
}
```

Alternatively, you can use `npx`, `pnpm dlx`, or `yarn dlx`:

| Runner | `command` | `args` |
|--------|-----------|--------|
| npx | `npx` | `["-y", "@n24q02m/better-email-mcp@latest"]` |
| pnpm | `pnpm` | `["dlx", "@n24q02m/better-email-mcp@latest"]` |
| yarn | `yarn` | `["dlx", "@n24q02m/better-email-mcp@latest"]` |

### Option 2: Docker

```jsonc
{
  "mcpServers": {
    "better-email": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "--name", "mcp-email",
        "-e", "EMAIL_CREDENTIALS",
        "n24q02m/better-email-mcp:latest"
      ],
      "env": {
        "EMAIL_CREDENTIALS": "user@gmail.com:abcd-efgh-ijkl-mnop"
      }
    }
  }
}
```

### Multiple Accounts

```bash
EMAIL_CREDENTIALS=user1@gmail.com:pass1,user2@outlook.com:pass2,user3@yahoo.com:pass3
```

### Custom IMAP Host

```bash
EMAIL_CREDENTIALS=user@custom.com:password:imap.custom.com
```

---

## Tools

| Tool | Actions |
|------|---------|
| `messages` | search, read, mark_read, mark_unread, flag, unflag, move, archive, trash |
| `folders` | list |
| `attachments` | list, download |
| `send` | new, reply, forward |
| `help` | Get full documentation for any tool |

### Search Query Language

| Query | Description |
|-------|-------------|
| `UNREAD` | Unread emails |
| `FLAGGED` | Starred emails |
| `SINCE 2024-01-01` | Emails after date |
| `FROM boss@company.com` | Emails from sender |
| `SUBJECT meeting` | Emails matching subject |
| `UNREAD SINCE 2024-06-01` | Compound filter |
| `UNREAD FROM boss@company.com` | Compound filter |

---

## Token Optimization

**Tiered descriptions** for minimal context usage:

| Tier | Purpose | When |
|------|---------|------|
| **Tier 1** | Compressed descriptions | Always loaded |
| **Tier 2** | Full docs via `help` tool | On-demand |
| **Tier 3** | MCP Resources | Supported clients |

```json
{"name": "help", "tool_name": "messages"}
```

### MCP Resources (Tier 3)

| URI | Description |
|-----|-------------|
| `email://docs/messages` | Messages tool docs |
| `email://docs/folders` | Folders tool docs |
| `email://docs/attachments` | Attachments tool docs |
| `email://docs/send` | Send tool docs |

---

## Supported Providers

| Provider | Auth | IMAP / SMTP | Save-to-Sent |
|----------|------|-------------|-------------|
| Gmail | App Password | `imap.gmail.com:993` / TLS (465) | Auto (skipped) |
| Yahoo | App Password | `imap.mail.yahoo.com:993` / TLS (465) | Auto (skipped) |
| iCloud/Me.com | App-Specific Password | `imap.mail.me.com:993` / STARTTLS (587) | Auto (skipped) |
| Outlook/Hotmail/Live | **OAuth2** (Device Code) | `outlook.office365.com:993` / STARTTLS (587) | IMAP APPEND |
| Zoho | App Password | `imap.zoho.com:993` / TLS (465) | IMAP APPEND |
| ProtonMail | ProtonMail Bridge | `imap.protonmail.ch:993` / TLS (465) | IMAP APPEND |
| Custom | Via `email:pass:imap.host` format | Configurable | IMAP APPEND |

### Outlook OAuth2

Outlook.com / Hotmail / Live accounts use OAuth2 automatically — just add the email to `EMAIL_CREDENTIALS`. On first use, the server returns a sign-in link and code. Open the link, enter the code, then retry your request. Tokens are saved to `~/.better-email-mcp/tokens.json` and auto-refresh silently.

> **Self-hosting with your own client ID?** Set `OUTLOOK_CLIENT_ID` env var. See [Azure Setup](src/docs/send.md#outlook-oauth2) for details.

---

## Build from Source

```bash
git clone https://github.com/n24q02m/better-email-mcp
cd better-email-mcp
mise run setup
bun run build
```

**Requirements:** Node.js 24+, [Bun](https://bun.sh/)

## Compatible With

[![Claude Desktop](https://img.shields.io/badge/Claude_Desktop-F9DC7C?logo=anthropic&logoColor=black)](#quick-start)
[![Claude Code](https://img.shields.io/badge/Claude_Code-000000?logo=anthropic&logoColor=white)](#quick-start)
[![Cursor](https://img.shields.io/badge/Cursor-000000?logo=cursor&logoColor=white)](#quick-start)
[![VS Code Copilot](https://img.shields.io/badge/VS_Code_Copilot-007ACC?logo=visualstudiocode&logoColor=white)](#quick-start)
[![Antigravity](https://img.shields.io/badge/Antigravity-4285F4?logo=google&logoColor=white)](#quick-start)
[![Gemini CLI](https://img.shields.io/badge/Gemini_CLI-8E75B2?logo=googlegemini&logoColor=white)](#quick-start)
[![OpenAI Codex](https://img.shields.io/badge/Codex-412991?logo=openai&logoColor=white)](#quick-start)
[![OpenCode](https://img.shields.io/badge/OpenCode-F7DF1E?logoColor=black)](#quick-start)

## Also by n24q02m

| Server | Description | Install |
|--------|-------------|---------|
| [better-notion-mcp](https://github.com/n24q02m/better-notion-mcp) | Notion API for AI agents | `npx -y @n24q02m/better-notion-mcp@latest` |
| [wet-mcp](https://github.com/n24q02m/wet-mcp) | Web search, content extraction, library docs | `uvx --python 3.13 wet-mcp@latest` |
| [mnemo-mcp](https://github.com/n24q02m/mnemo-mcp) | Persistent AI memory with hybrid search | `uvx mnemo-mcp@latest` |
| [better-godot-mcp](https://github.com/n24q02m/better-godot-mcp) | Godot Engine for AI agents | `npx -y @n24q02m/better-godot-mcp@latest` |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## License

MIT - See [LICENSE](LICENSE)
