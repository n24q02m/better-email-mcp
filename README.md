# Better Email MCP

mcp-name: io.github.n24q02m/better-email-mcp

**IMAP/SMTP email server for AI agents -- 5 composite tools with multi-account and auto-discovery**

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

<a href="https://glama.ai/mcp/servers/n24q02m/better-email-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/n24q02m/better-email-mcp/badge" alt="Better Email MCP server" />
</a>

## Features

- **Multi-account support** -- manage 6+ email accounts (Gmail, Outlook, Yahoo, iCloud, Zoho, ProtonMail, custom IMAP)
- **App Passwords** -- no OAuth2 setup required for most providers; clone and run in 1 minute
- **5 composite tools** with 15 actions -- search, read, send, reply, forward, organize in single calls
- **Auto-discovery** -- provider settings detected from email address, custom IMAP host supported
- **Thread-aware** -- reply/forward maintains In-Reply-To and References headers
- **Tiered token optimization** -- compressed descriptions + on-demand `help` tool + MCP Resources

## Quick Start

### Claude Code Plugin (Recommended)

Via marketplace (includes skills: /inbox-review, /follow-up):

```bash
/plugin marketplace add n24q02m/claude-plugins
/plugin install better-email-mcp@n24q02m-plugins
```



Set credentials in `~/.claude/settings.local.json` or shell profile. See [Prerequisites](#mcp-server).

### Gemini CLI Extension

```bash
gemini extensions install https://github.com/n24q02m/better-email-mcp
```

### Codex CLI

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.better-email-mcp]
command = "npx"
args = ["-y", "@n24q02m/better-email-mcp"]
```

### MCP Server

**Prerequisites:** Create App Passwords (NOT your regular password):
- **Gmail**: Enable 2FA, then <https://myaccount.google.com/apppasswords>
- **Yahoo**: Enable 2FA, then <https://login.yahoo.com/account/security/app-passwords>
- **iCloud**: <https://appleid.apple.com> > Sign-In and Security > App-Specific Passwords
- **Outlook/Hotmail/Live**: OAuth2 built-in (server guides you on first use)

#### Option 1: npx

```jsonc
{
  "mcpServers": {
    "better-email": {
      "command": "npx",
      "args": ["-y", "@n24q02m/better-email-mcp@latest"]
    }
  }
}
```

Other runners: `bun x`, `pnpm dlx`, `yarn dlx` also work.

#### Option 2: Docker

```jsonc
{
  "mcpServers": {
    "better-email": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "EMAIL_CREDENTIALS",
        "n24q02m/better-email-mcp:latest"
      ]
    }
  }
}
```

Configure `EMAIL_CREDENTIALS` in `~/.claude/settings.local.json` or your shell profile. See [Environment Variables](#environment-variables) below.

## Tools

| Tool | Actions | Description |
|:-----|:--------|:------------|
| `messages` | `search`, `read`, `mark_read`, `mark_unread`, `flag`, `unflag`, `move`, `archive`, `trash` | Search, read, and organize emails |
| `folders` | `list` | List mailbox folders |
| `attachments` | `list`, `download` | List and download email attachments |
| `send` | `new`, `reply`, `forward` | Compose, reply, and forward emails |
| `help` | - | Get full documentation for any tool |

### MCP Resources

| URI | Description |
|:----|:------------|
| `email://docs/messages` | Message operations reference |
| `email://docs/folders` | Folder operations reference |
| `email://docs/attachments` | Attachment operations reference |
| `email://docs/send` | Send/compose reference |
| `email://docs/help` | Full documentation |

## Zero-Config Setup

No environment variables needed. On first start, the server opens a relay setup page:

1. Start the server (via plugin, `npx`, or Docker)
2. A setup URL appears -- open it in any browser (relay: `https://better-email-mcp.n24q02m.com`)
3. Enter your credentials in `email:app-password` format (comma-separated for multi-account)
4. Credentials are encrypted and stored locally

Your credentials never leave your machine. The relay server only sees encrypted data.

For CI/automation, you can still use environment variables (see below).

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

```bash
docker run -p 8080:8080 \
  -e TRANSPORT_MODE=http \
  -e PUBLIC_URL=https://your-domain.com \
  -e DCR_SERVER_SECRET=$(openssl rand -hex 32) \
  n24q02m/better-email-mcp:latest
```

Users provide their own email credentials through the OAuth flow. No server-side `EMAIL_CREDENTIALS` needed.

## Outlook OAuth Device Code

Outlook, Hotmail, and Live accounts use OAuth2 automatically. On first use with an Outlook account:

1. The server prints a device code and a Microsoft login URL
2. Open the URL in a browser and enter the code
3. Sign in and authorize the app
4. Tokens are saved locally at `~/.better-email-mcp/tokens.json`

No App Password is needed for Outlook accounts.

## Configuration

| Variable | Required | Default | Description |
|:---------|:---------|:--------|:------------|
| `EMAIL_CREDENTIALS` | Yes (stdio) | - | Email credentials (`user@gmail.com:app-password`, comma-separated for multi-account) |
| `TRANSPORT_MODE` | No | `stdio` | Set to `http` for remote mode |
| `PUBLIC_URL` | Yes (http) | - | Server's public URL for OAuth redirects |
| `DCR_SERVER_SECRET` | Yes (http) | - | HMAC secret for stateless client registration |
| `PORT` | No | `8080` | Server port |
| `OUTLOOK_CLIENT_ID` | No | - | Custom Azure AD client ID for self-hosted Outlook OAuth2 |

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

## License

MIT -- See [LICENSE](LICENSE).
