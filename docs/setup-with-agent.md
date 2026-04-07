# Better Email MCP -- Agent Setup Guide

> Give this file to your AI agent to automatically set up better-email-mcp.

## Option 1: Claude Code Plugin (Recommended)

```bash
/plugin marketplace add n24q02m/claude-plugins
/plugin install better-email-mcp@n24q02m-plugins
```

This installs the server with skills: `/inbox-review`, `/follow-up`.

On first start, a relay setup page opens in the browser where the user enters email credentials. No environment variables needed.

## Option 2: MCP Direct

### Claude Code (settings.json)

Add to `.claude/settings.json` or `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "better-email-mcp": {
      "command": "npx",
      "args": ["-y", "@n24q02m/better-email-mcp"],
      "env": {
        "EMAIL_CREDENTIALS": "user@gmail.com:app-password"
      }
    }
  }
}
```

For multiple accounts:
```json
{
  "env": {
    "EMAIL_CREDENTIALS": "user1@gmail.com:pass1,user2@outlook.com:pass2"
  }
}
```

### Codex CLI (config.toml)

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.better-email-mcp]
command = "npx"
args = ["-y", "@n24q02m/better-email-mcp"]

[mcp_servers.better-email-mcp.env]
EMAIL_CREDENTIALS = "user@gmail.com:app-password"
```

### OpenCode (opencode.json)

Add to `opencode.json` in your project root:

```json
{
  "mcpServers": {
    "better-email-mcp": {
      "command": "npx",
      "args": ["-y", "@n24q02m/better-email-mcp"],
      "env": {
        "EMAIL_CREDENTIALS": "user@gmail.com:app-password"
      }
    }
  }
}
```

## Option 3: Docker

```json
{
  "mcpServers": {
    "better-email-mcp": {
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

Set `EMAIL_CREDENTIALS` in your shell profile or pass it inline.

## Option 4: HTTP Remote

For multi-user mode with OAuth 2.1 authentication (no local credentials needed):

### Claude Code (settings.json)

```json
{
  "mcpServers": {
    "better-email-mcp": {
      "type": "http",
      "url": "https://better-email-mcp.n24q02m.com/mcp"
    }
  }
}
```

### Codex CLI (config.toml)

```toml
[mcp_servers.better-email-mcp]
type = "http"
url = "https://better-email-mcp.n24q02m.com/mcp"
```

### OpenCode (opencode.json)

```json
{
  "mcpServers": {
    "better-email-mcp": {
      "type": "http",
      "url": "https://better-email-mcp.n24q02m.com/mcp"
    }
  }
}
```

Users provide their own email credentials through the OAuth flow.

## Environment Variables

| Variable | Required | Default | Description |
|:---------|:---------|:--------|:------------|
| `EMAIL_CREDENTIALS` | Yes (stdio) | -- | Email credentials. Format: `user@gmail.com:app-password`. Multi-account: comma-separated. Custom IMAP: `user@custom.com:pass:imap.custom.com`. |
| `TRANSPORT_MODE` | No | `stdio` | Set to `http` for remote multi-user mode. |
| `PUBLIC_URL` | Yes (http) | -- | Server's public URL for OAuth redirects (http mode only). |
| `DCR_SERVER_SECRET` | Yes (http) | -- | HMAC secret for stateless client registration (http mode only). |
| `PORT` | No | `8080` | Server port (http mode only). |
| `OUTLOOK_CLIENT_ID` | No | -- | Custom Azure AD client ID for self-hosted Outlook OAuth2. |

## Authentication

### Gmail, Yahoo, iCloud

Use **App Passwords** (not your regular password):
- **Gmail**: Enable 2FA, then create at https://myaccount.google.com/apppasswords
- **Yahoo**: Enable 2FA, then create at https://login.yahoo.com/account/security/app-passwords
- **iCloud**: Go to https://appleid.apple.com > Sign-In and Security > App-Specific Passwords

### Outlook / Hotmail / Live

OAuth2 with Device Code Flow (automatic). On first use:
1. The server prints a device code and a Microsoft login URL
2. Open the URL and enter the code
3. Sign in and authorize
4. Tokens are saved locally at `~/.better-email-mcp/tokens.json`

No App Password needed for Outlook accounts.

### Custom IMAP

```
EMAIL_CREDENTIALS=user@custom.com:password:imap.custom.com
```

## Zero-Config Relay

> **Recommended.** The relay is the primary setup method. Credentials are encrypted end-to-end and stored locally. Environment variables are supported for backward compatibility.


If `EMAIL_CREDENTIALS` is not set, the server opens a relay setup page:
1. A setup URL appears in the terminal
2. Open it in a browser
3. Enter credentials in the form
4. Credentials are encrypted and stored locally

## Verification

After setup, verify the server is working:

```
Use the folders tool with action "list" to verify the server can connect to your email account.
```

Expected: a list of mailbox folders (INBOX, Sent, Drafts, etc.).
