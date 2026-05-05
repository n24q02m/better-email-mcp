# Better Email MCP -- Manual Setup Guide

> **2026-05-02 Update (v&lt;auto&gt;+)**: Plugin install (Method 1) uses stdio mode with `EMAIL_PROVIDER` + `EMAIL_USER` + `EMAIL_APP_PASSWORD` env vars.
> The previous "Zero-Config Relay" auto-spawn pattern has been removed.
> If you relied on the relay form, please:
> 1. Set env vars in plugin config (Method 1), OR
> 2. Switch to HTTP mode (Method 3 (Docker HTTP — Hosted or Self-host)) for browser-based setup.

## Method overview

This plugin supports 3 install methods. Pick the one that matches your use case:

| Priority | Method | Transport | Best for |
|---|---|---|---|
| **1. Default** | Plugin install (`uvx`/`npx`) | stdio | Quick local start, single workstation, no OAuth/HTTP needed. |
| **2. Fallback** | Docker stdio (`docker run -i --rm`) | stdio | Windows/macOS where native uvx/npx hits PATH or Python version issues. |
| **3. Recommended** | Docker HTTP (`docker run -p 8080:8080`) | HTTP | Multi-device, OAuth/relay-form auth, team self-host, claude.ai web compatibility. |

All MCP servers across this stack share this priority hierarchy. Note: 2 plugins (`better-godot-mcp` and `better-code-review-graph`) only support Method 1 (stdio) -- they need direct host access to project files / repo paths and don't ship Docker / HTTP variants.

> **⚠️ Mutually exclusive — pick ONE per plugin**: If you choose Method 2 (Docker stdio override) OR Method 3 (HTTP), do NOT also `/plugin install` this plugin via marketplace. Both load simultaneously and create duplicate entries in `/mcp` dialog (plugin's stdio + your override). Plugin matching is by **endpoint** (URL or command string) per CC docs, not by name — and `npx`/`uvx` ≠ `docker` ≠ HTTP URL, so all three are distinct endpoints. Trade-off: choosing Method 2 or Method 3 means you lose this plugin's skills/agents/hooks/commands. For full plugin features, use Method 1 (default plugin install) with `userConfig` credentials prompted at install time.

## Prerequisites

- **Node.js** >= 24.14.1
- An email account with App Password enabled (Gmail, Yahoo, iCloud) or an Outlook/Hotmail/Live account (HTTP mode uses OAuth2 with bundled public client)

### Create App Passwords

App Passwords are required for App-Password providers (NOT your regular password):

- **Gmail**: Enable 2FA at https://myaccount.google.com/security, then create an App Password at https://myaccount.google.com/apppasswords (Settings → Security → 2-Step Verification → App passwords)
- **Yahoo**: Enable 2FA, then go to https://login.yahoo.com/account/security/app-passwords
- **iCloud / Me.com**: Go to https://appleid.apple.com → Sign-In and Security → App-Specific Passwords
- **Outlook / Hotmail / Live**: Stdio mode also accepts an Outlook App Password (Account Settings → Security → Advanced security options → App passwords). HTTP mode uses delegated OAuth2 with a bundled public client — no App Password needed.

## Method 1: Claude Code Plugin (Recommended)

Plugin install runs in **stdio mode** with credentials provided via the `userConfig` install prompt.

### Credential prompts at install

When you run `/plugin install`, Claude Code prompts you for the following credentials (declared in `userConfig` per CC docs). Sensitive values are stored in your system keychain and persist across `/plugin update`:

| Field | Required | Where to obtain |
|---|---|---|
| `EMAIL_CREDENTIALS` | Required | Format: `user@gmail.com:app-password` (multi: comma-separated) |

### Steps

1. Prepare an App Password for each account (see "Create App Passwords" above).
2. Open Claude Code in your terminal.
3. Install the plugin (Claude Code prompts for `EMAIL_CREDENTIALS`):
   ```bash
   /plugin marketplace add n24q02m/claude-plugins
   /plugin install better-email-mcp@n24q02m-plugins
   ```
4. Restart Claude Code -- the plugin auto-loads with your credentials injected.

> **Note**: This installs the full plugin (skills + agents + hooks + commands + stdio MCP server). If you'd rather use Method 2 (Docker stdio) or Method 3 (HTTP) below, DO NOT `/plugin install` this plugin — pick Method 2 or Method 3 instead. All three methods are mutually exclusive (see Method overview).

## Method 2: Docker stdio (fallback)

> **⚠️ Before adding the Docker stdio override below, ensure this plugin is NOT installed via marketplace**: Run `/plugin uninstall better-email-mcp@n24q02m-plugins` first if you previously ran `/plugin install`. Otherwise both entries (plugin's `npx`/`uvx` stdio + your `docker run` stdio) will load simultaneously since plugin matches by endpoint (command string), not by name.
>
> **Trade-off accepted**: Choosing this method means you lose this plugin's skills/agents/hooks/commands. Use Method 1 instead if you want full plugin features.

1. Pull the image:
   ```bash
   docker pull n24q02m/better-email-mcp:latest
   ```

2. Add to your MCP client config:
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

3. Set env vars in your shell profile:
   ```bash
   export EMAIL_PROVIDER="gmail"
   export EMAIL_USER="you@gmail.com"
   export EMAIL_APP_PASSWORD="abcd efgh ijkl mnop"
   ```

## Why upgrade to HTTP mode?

Stdio mode is the default and works for single-user local development. Consider switching to **HTTP mode** when you need any of:

- **claude.ai web compatibility** — connect the server directly from claude.ai without a local CLI
- **1 server shared across N Claude Code sessions** — no per-session daemon proliferation
- **Browser-based OAuth flow for Outlook** — bundled Outlook OAuth client; no Azure app registration needed
- **Multi-device credential sync** — credentials persist server-side; new devices just point to the URL
- **Multi-user / team sharing** — per-JWT-sub credential isolation; one deployment serves the team
- **Always-on persistent process** — required for webhooks, scheduled inbox scans, or long-running agents

## Method 3: Docker HTTP (recommended)

> **⚠️ Before adding the HTTP override below, ensure this plugin is NOT installed via marketplace**: Run `/plugin uninstall better-email-mcp@n24q02m-plugins` first if you previously ran `/plugin install`. Otherwise both entries (plugin's stdio + your HTTP override) will load simultaneously since plugin matches by endpoint, not name.
>
> **Trade-off accepted**: Choosing this method means you lose this plugin's skills/agents/hooks/commands. For example, the `better-email-mcp:inbox-review` skill will no longer be available. Use Method 1 instead if you want full plugin features.

> **Switching transport vs. setting credentials**: The `userConfig` prompt only configures credentials for stdio mode (Method 1 / Option 1). To switch transport to HTTP, override `mcpServers` in your client settings per the snippets below -- this is a separate path from `userConfig` and is not driven by the install prompt.

### 3.1. Hosted (n24q02m.com)

Use the n24q02m-hosted instance:

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

On first call the server initiates the **OAuth flow**. Outlook/Hotmail/Live accounts get a Microsoft device-code link (powered by the bundled public Outlook OAuth client `d56f8c71-9f7c-43f4-9934-be29cb6e77b0` — Thunderbird-pattern public client per Google/Microsoft installed-app convention; no user-side Azure app registration needed). Gmail / Yahoo / iCloud / custom IMAP accounts use the relay paste form.

### 3.2. Self-host with docker-compose

Single multi-user mode (relay form for App-Password providers + bundled Outlook OAuth):

```bash
docker run -p 8080:8080 \
  -e PUBLIC_URL=https://your-domain.com \
  -e DCR_SERVER_SECRET=$(openssl rand -hex 32) \
  n24q02m/better-email-mcp:latest
```

Optional environment overrides:
- `OUTLOOK_CLIENT_ID` — override the bundled Azure public client (rarely needed; the bundled `d56f8c71-9f7c-43f4-9934-be29cb6e77b0` works out of the box)
- `OUTLOOK_EMAIL` — workaround for Microsoft device-code responses missing the email field; sets the token persistence key (`tokens/<email>.json`)

### Edge auth: relay password

Public HTTP deployments expose `<your-domain>/authorize` to URL discovery. To prevent random Internet users from accessing the relay form, mint a relay password:

```bash
openssl rand -hex 32
# Save in your skret / .env as:
MCP_RELAY_PASSWORD=<generated-32-byte-hex>
```

Share this password out-of-band (Signal/email/SMS) with anyone you invite to use your server. They will see a login form when first opening `/authorize`; once logged in, the cookie persists 24 hours.

**Single-user dev exception**: If `PUBLIC_URL=http://localhost:8080`, you can leave `MCP_RELAY_PASSWORD` empty to disable the gate. The server logs a warning if you skip the password with a non-localhost `PUBLIC_URL`.

Point clients to your server URL:
```json
{
  "mcpServers": {
    "better-email-mcp": {
      "type": "http",
      "url": "https://your-domain.com/mcp"
    }
  }
}
```

The server runs in single multi-user mode: per-JWT-sub credential isolation, OAuth 2.1 + Dynamic Client Registration. The first request from each user triggers either a Microsoft device-code link (Outlook) or a paste form (Gmail/Yahoo/iCloud/custom IMAP).

## Credential Setup (Stdio mode)

### Single Account (preferred — provider auto-detected from `EMAIL_PROVIDER`)

```bash
EMAIL_PROVIDER=gmail
EMAIL_USER=you@gmail.com
EMAIL_APP_PASSWORD=abcd efgh ijkl mnop
```

`EMAIL_PROVIDER` accepts: `gmail`, `outlook`, `yahoo`, `icloud`, `zoho`, `custom`.

### Multiple Accounts (legacy `EMAIL_CREDENTIALS` format)

```bash
EMAIL_CREDENTIALS=user1@gmail.com:pass1,user2@outlook.com:pass2,user3@yahoo.com:pass3
```

### Custom IMAP Host

For providers not auto-detected:

```bash
EMAIL_CREDENTIALS=user@custom.com:password:imap.custom.com
```

or with the typed form (single account only):

```bash
EMAIL_PROVIDER=custom
EMAIL_USER=user@custom.com
EMAIL_APP_PASSWORD=password
EMAIL_IMAP_HOST=imap.custom.com
```

## Environment Variable Reference

| Variable | Required | Default | Description |
|:---------|:---------|:--------|:------------|
| `EMAIL_PROVIDER` | Yes (stdio, single-account) | -- | Provider key: `gmail`, `outlook`, `yahoo`, `icloud`, `zoho`, `custom`. |
| `EMAIL_USER` | Yes (stdio, single-account) | -- | Email address. |
| `EMAIL_APP_PASSWORD` | Yes (stdio, single-account) | -- | App password (Gmail/Yahoo/iCloud) or Outlook App Password. |
| `EMAIL_IMAP_HOST` | No (custom only) | -- | Custom IMAP hostname when `EMAIL_PROVIDER=custom`. |
| `EMAIL_CREDENTIALS` | Alternative (multi-account) | -- | Legacy format `user@gmail.com:app-password` (comma-separated for multi-account; `user@custom.com:pass:imap.custom.com` for custom IMAP). |
| `PUBLIC_URL` | Yes (http) | -- | Server's public URL for OAuth redirects. |
| `DCR_SERVER_SECRET` | Yes (http) | -- | HMAC secret for stateless Dynamic Client Registration. |
| `PORT` | No | `8080` | Server port (http mode). |
| `OUTLOOK_CLIENT_ID` | No | `d56f8c71-9f7c-43f4-9934-be29cb6e77b0` (bundled public client) | Override the bundled Azure AD public client for self-hosted Outlook OAuth2. |
| `OUTLOOK_EMAIL` | No | -- | Workaround when Microsoft device-code response omits the email field — sets token persistence key. |

## Supported Providers

| Provider | Stdio Auth | HTTP Auth | Save-to-Sent |
|:---------|:-----------|:----------|:-------------|
| Gmail | App Password | Relay paste form | Auto (skipped — Gmail saves sent mail) |
| Yahoo | App Password | Relay paste form | Auto (skipped) |
| iCloud / Me.com | App-Specific Password | Relay paste form | Auto (skipped) |
| Outlook / Hotmail / Live | App Password | OAuth2 Device Code (bundled public client) | IMAP APPEND |
| Zoho | App Password | Relay paste form | IMAP APPEND |
| ProtonMail | ProtonMail Bridge | Relay paste form | IMAP APPEND |
| Custom IMAP | `EMAIL_IMAP_HOST` or `email:pass:imap.host` | Relay paste form | IMAP APPEND |

## Troubleshooting

### "Authentication failed" for Gmail

- Ensure you created an **App Password**, not using your regular Google password.
- Verify 2-Step Verification is enabled on your Google account.
- The App Password format is 16 characters (often shown as 4 groups of 4 with spaces — both with and without spaces work).

### "Authentication failed" for Yahoo

- Create an App Password at https://login.yahoo.com/account/security/app-passwords
- Yahoo App Passwords bypass "Allow apps that use less secure sign in" settings.

### Outlook in stdio mode

- Stdio mode requires an Outlook **App Password** (Account Settings → Security → Advanced security options → App passwords). The OAuth2 device-code flow is HTTP-mode-only.
- For OAuth2 (no App Password), switch to HTTP mode (Method 3 Docker HTTP (Hosted or Self-host)).

### Outlook OAuth not starting (HTTP mode)

- The first call from a new JWT sub triggers the device-code flow. Watch the client for a Microsoft login URL.
- The bundled public client `d56f8c71-9f7c-43f4-9934-be29cb6e77b0` (Thunderbird-pattern) works out of the box; you only need `OUTLOOK_CLIENT_ID` if you want a custom Azure app.

### "IMAP connection timeout"

- Check your internet connection.
- For custom IMAP hosts, verify the hostname and that port 993 (IMAPS) is accessible.
- Some corporate networks block IMAP. Try from a different network.

### Multiple accounts: only one account works

- Ensure comma separation with no spaces: `user1@gmail.com:pass1,user2@yahoo.com:pass2`
- Each account must have valid credentials independently.
- For multi-account in stdio mode you must use `EMAIL_CREDENTIALS` (the typed `EMAIL_PROVIDER` + `EMAIL_USER` + `EMAIL_APP_PASSWORD` form is single-account).
