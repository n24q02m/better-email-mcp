# Better Email MCP

**IMAP/SMTP MCP Server for Email - Optimized for AI Agents**

[![CI](https://github.com/n24q02m/better-email-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/n24q02m/better-email-mcp/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@n24q02m/better-email-mcp)](https://www.npmjs.com/package/@n24q02m/better-email-mcp)
[![Docker](https://img.shields.io/docker/v/n24q02m/better-email-mcp?label=docker)](https://hub.docker.com/r/n24q02m/better-email-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

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
- **Outlook**: Enable 2FA, then <https://account.live.com/proofs/manage/additional> > App passwords

### Option 1: npx (Recommended)

```jsonc
{
  "mcpServers": {
    "better-email": {
      "command": "npx",
      "args": ["-y", "@n24q02m/better-email-mcp@latest"],
      "env": {
        "EMAIL_CREDENTIALS": "user@gmail.com:abcd-efgh-ijkl-mnop"
      }
    }
  }
}
```

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

| Provider | Auto-Discovery | IMAP | SMTP |
|----------|---------------|------|------|
| Gmail | `imap.gmail.com:993` | TLS | TLS (465) |
| Outlook/Hotmail/Live | `outlook.office365.com:993` | TLS | STARTTLS (587) |
| Yahoo | `imap.mail.yahoo.com:993` | TLS | TLS (465) |
| iCloud/Me.com | `imap.mail.me.com:993` | TLS | STARTTLS (587) |
| Zoho | `imap.zoho.com:993` | TLS | TLS (465) |
| ProtonMail | `imap.protonmail.ch:993` | TLS | TLS (465) |
| Custom | Via `email:pass:imap.host` format | Configurable | Auto-derived |

---

## Build from Source

```bash
git clone https://github.com/n24q02m/better-email-mcp
cd better-email-mcp
mise run setup
pnpm build
```

**Requirements:** Node.js 24+, pnpm

## License

MIT - See [LICENSE](LICENSE)
