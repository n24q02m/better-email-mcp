# Better Email MCP -- Agent Setup Guide

> **2026-05-02 Update (v&lt;auto&gt;+)**: Plugin install (Option 1) uses stdio mode with `EMAIL_PROVIDER` + `EMAIL_USER` + `EMAIL_APP_PASSWORD` env vars.
> The previous "Zero-Config Relay" auto-spawn pattern has been removed.
> If you relied on the relay form, please:
> 1. Set env vars in plugin config (Option 1), OR
> 2. Switch to HTTP mode (Option 3 (Docker HTTP — Hosted or Self-host)) for browser-based setup.

> Give this file to your AI agent to automatically set up better-email-mcp.

## Method overview

This plugin supports 3 install methods. Pick the one that matches your use case:

| Priority | Method | Transport | Best for |
|---|---|---|---|
| **1. Default** | Plugin install (`uvx`/`npx`) | stdio | Quick local start, single workstation, no OAuth/HTTP needed. |
| **2. Fallback** | Docker stdio (`docker run -i --rm`) | stdio | Windows/macOS where native uvx/npx hits PATH or Python version issues. |
| **3. Recommended** | Docker HTTP (`docker run -p 8080:8080`) | HTTP | Multi-device, OAuth/relay-form auth, team self-host, claude.ai web compatibility. |

All MCP servers across this stack share this priority hierarchy. Note: 2 plugins (`better-godot-mcp` and `better-code-review-graph`) only support Method 1 (stdio) -- they need direct host access to project files / repo paths and don't ship Docker / HTTP variants.

## Option 1: Claude Code Plugin (Recommended -- stdio + userConfig prompt)

### Step 0: Credential prompt

When the install command runs, Claude Code prompts for the field declared in `plugin.json` `userConfig`:

| Field | Required | Sensitive | Format |
|:------|:---------|:----------|:-------|
| `EMAIL_CREDENTIALS` | Yes | Yes | `user@gmail.com:app-password` (single) or `user1@x:p1,user2@y:p2` (multi). Custom IMAP host: append `:imap.host`. |

The plugin manifest substitutes the value into `mcpServers.better-email-mcp.env.EMAIL_CREDENTIALS` via `${user_config.EMAIL_CREDENTIALS}`. Sensitive values are kept in the system keychain and persist across `/plugin update` -- you do not edit `env` manually.

### Steps

```bash
/plugin marketplace add n24q02m/claude-plugins
/plugin install better-email-mcp@n24q02m-plugins
```

Paste your `EMAIL_CREDENTIALS` value when prompted. This installs the server with skills: `/inbox-review`, `/follow-up`. Restart Claude Code -- the plugin auto-loads with your credentials.

> **HTTP transport (Option 3)** is a separate install path; the `userConfig` prompt does not apply, and you manually configure `mcpServers` for HTTP per Option 3 below.

## Option 2: Docker stdio (fallback)

```json
{
  "mcpServers": {
    "better-email-mcp": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "EMAIL_PROVIDER",
        "-e", "EMAIL_USER",
        "-e", "EMAIL_APP_PASSWORD",
        "n24q02m/better-email-mcp:latest"
      ]
    }
  }
}
```

Set env vars in your shell profile or pass them inline.

## Why upgrade to HTTP mode?

Stdio mode is the default and works for single-user local development. Switch to **HTTP mode** when you need any of:

- **claude.ai web compatibility** — connect the server directly from claude.ai without a local CLI
- **1 server shared across N Claude Code sessions** — no per-session daemon proliferation
- **Browser-based OAuth flow for Outlook** — bundled Outlook OAuth client; no Azure app registration needed
- **Multi-device credential sync** — credentials persist server-side; new devices just point to the URL
- **Multi-user / team sharing** — per-JWT-sub credential isolation; one deployment serves the team
- **Always-on persistent process** — required for webhooks, scheduled inbox scans, or long-running agents

## Option 3: Docker HTTP (recommended)

### 3.1. Hosted (n24q02m.com)

Multi-user mode with OAuth 2.1 + bundled Outlook OAuth (no local credentials needed):

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

The first request from each user triggers either a Microsoft device-code link (Outlook) or a paste form (Gmail/Yahoo/iCloud/custom IMAP). Outlook OAuth uses the bundled public Azure client (`d56f8c71-9f7c-43f4-9934-be29cb6e77b0`, Thunderbird-pattern) — no user-side Azure app registration needed.

### 3.2. Self-host with docker-compose

Run your own multi-user instance:

```bash
docker run -p 8080:8080 \
  -e PUBLIC_URL=https://your-domain.com \
  -e DCR_SERVER_SECRET=$(openssl rand -hex 32) \
  n24q02m/better-email-mcp:latest
```

Optional overrides:
- `OUTLOOK_CLIENT_ID` — override the bundled public Azure client (rarely needed)
- `OUTLOOK_EMAIL` — workaround for Microsoft device-code responses missing the email field

The server runs in single multi-user mode (relay paste form for App-Password providers + bundled Outlook OAuth device-code). Per-JWT-sub credential isolation, OAuth 2.1 + Dynamic Client Registration.

### Edge auth: relay password

Public HTTP deployments expose `<your-domain>/authorize` to URL discovery. To prevent random Internet users from accessing the relay form, mint a relay password:

```bash
openssl rand -hex 32
# Save in your skret / .env as:
MCP_RELAY_PASSWORD=<generated-32-byte-hex>
```

Share this password out-of-band (Signal/email/SMS) with anyone you invite to use your server. They will see a login form when first opening `/authorize`; once logged in, the cookie persists 24 hours.

**Single-user dev exception**: If `PUBLIC_URL=http://localhost:8080`, you can leave `MCP_RELAY_PASSWORD` empty to disable the gate. The server logs a warning if you skip the password with a non-localhost `PUBLIC_URL`.

## Environment Variables

| Variable | Required | Default | Description |
|:---------|:---------|:--------|:------------|
| `EMAIL_PROVIDER` | Yes (stdio, single-account) | -- | Provider key: `gmail`, `outlook`, `yahoo`, `icloud`, `zoho`, `custom`. |
| `EMAIL_USER` | Yes (stdio, single-account) | -- | Email address. |
| `EMAIL_APP_PASSWORD` | Yes (stdio, single-account) | -- | App password (Gmail/Yahoo/iCloud) or Outlook App Password. |
| `EMAIL_IMAP_HOST` | No (custom only) | -- | Custom IMAP hostname when `EMAIL_PROVIDER=custom`. |
| `EMAIL_CREDENTIALS` | Alternative (multi-account) | -- | Legacy `user@gmail.com:app-password` format. Multi-account: comma-separated. Custom IMAP: `user@custom.com:pass:imap.custom.com`. |
| `PUBLIC_URL` | Yes (http) | -- | Server's public URL for OAuth redirects (http mode only). |
| `DCR_SERVER_SECRET` | Yes (http) | -- | HMAC secret for stateless client registration (http mode only). |
| `PORT` | No | `8080` | Server port (http mode only). |
| `OUTLOOK_CLIENT_ID` | No | `d56f8c71-9f7c-43f4-9934-be29cb6e77b0` (bundled public client) | Custom Azure AD public client for self-hosted Outlook OAuth2. |
| `OUTLOOK_EMAIL` | No | -- | Workaround when Microsoft device-code response omits the email field — sets token persistence key. |

## Authentication

### Gmail, Yahoo, iCloud (App Passwords)

Stdio + HTTP both accept **App Passwords** (not your regular password):
- **Gmail**: Enable 2FA, then create at https://myaccount.google.com/apppasswords
- **Yahoo**: Enable 2FA, then create at https://login.yahoo.com/account/security/app-passwords
- **iCloud**: Go to https://appleid.apple.com → Sign-In and Security → App-Specific Passwords

### Outlook / Hotmail / Live

- **Stdio mode**: requires an Outlook **App Password** (Account Settings → Security → Advanced security options → App passwords).
- **HTTP mode**: uses OAuth2 Device Code with the bundled public Azure client (`d56f8c71-9f7c-43f4-9934-be29cb6e77b0`). On first use:
  1. The server prints a device code and a Microsoft login URL
  2. Open the URL and enter the code
  3. Sign in and authorize
  4. Tokens are saved per JWT sub (`tokens/<sub>.json`)
- No App Password is needed for Outlook in HTTP mode.

### Custom IMAP

```
EMAIL_PROVIDER=custom
EMAIL_USER=user@custom.com
EMAIL_APP_PASSWORD=password
EMAIL_IMAP_HOST=imap.custom.com
```

or via legacy compact form:

```
EMAIL_CREDENTIALS=user@custom.com:password:imap.custom.com
```

## Verification

After setup, verify the server is working:

```
Use the folders tool with action "list" to verify the server can connect to your email account.
```

Expected: a list of mailbox folders (INBOX, Sent, Drafts, etc.).
