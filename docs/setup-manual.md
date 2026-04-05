# Better Email MCP -- Manual Setup Guide

## Prerequisites

- **Node.js** >= 24.14.1
- An email account with App Password enabled (Gmail, Yahoo, iCloud) or an Outlook/Hotmail/Live account (OAuth2 built-in)

### Create App Passwords

App Passwords are required for most providers (NOT your regular password):

- **Gmail**: Enable 2FA at https://myaccount.google.com/security, then create an App Password at https://myaccount.google.com/apppasswords
- **Yahoo**: Enable 2FA, then go to https://login.yahoo.com/account/security/app-passwords
- **iCloud / Me.com**: Go to https://appleid.apple.com > Sign-In and Security > App-Specific Passwords
- **Outlook / Hotmail / Live**: No App Password needed -- OAuth2 Device Code Flow is built-in

## Method 1: Claude Code Plugin (Recommended)

1. Open Claude Code in your terminal
2. Run:
   ```bash
   /plugin marketplace add n24q02m/claude-plugins
   /plugin install better-email-mcp@n24q02m-plugins
   ```
3. On first start, a relay setup URL appears in the terminal (BETA flow). Open it in a browser and enter your email credentials. **Recommended**: use environment variables (`EMAIL_CREDENTIALS`) instead for stable production use.
4. Alternatively, set `EMAIL_CREDENTIALS` in `~/.claude/settings.local.json` or your shell profile.

## Method 2: npx (Any MCP Client)

1. Add the following to your MCP client configuration file:

   **Claude Code** -- `.claude/settings.json` or `~/.claude/settings.json`:
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

   **Codex CLI** -- `~/.codex/config.toml`:
   ```toml
   [mcp_servers.better-email-mcp]
   command = "npx"
   args = ["-y", "@n24q02m/better-email-mcp"]

   [mcp_servers.better-email-mcp.env]
   EMAIL_CREDENTIALS = "user@gmail.com:app-password"
   ```

   **OpenCode** -- `opencode.json`:
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

2. Replace `user@gmail.com:app-password` with your actual credentials.
3. Restart your MCP client.

Other package runners (`bun x`, `pnpm dlx`, `yarn dlx`) also work in place of `npx -y`.

## Method 3: Docker

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
           "-e", "EMAIL_CREDENTIALS",
           "n24q02m/better-email-mcp:latest"
         ]
       }
     }
   }
   ```

3. Set `EMAIL_CREDENTIALS` in your shell profile:
   ```bash
   export EMAIL_CREDENTIALS="user@gmail.com:app-password"
   ```

## Method 4: HTTP Remote (Multi-User)

For multi-user mode with OAuth 2.1 PKCE authentication. Users provide their own credentials through the OAuth flow.

### Using a hosted instance

Add to your MCP client config:
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

### Self-hosting

1. Run the server in HTTP mode:
   ```bash
   docker run -p 8080:8080 \
     -e TRANSPORT_MODE=http \
     -e PUBLIC_URL=https://your-domain.com \
     -e DCR_SERVER_SECRET=$(openssl rand -hex 32) \
     n24q02m/better-email-mcp:latest
   ```

2. Point clients to your server URL:
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

## Method 5: Build from Source

1. Clone and build:
   ```bash
   git clone https://github.com/n24q02m/better-email-mcp.git
   cd better-email-mcp
   bun install
   bun run build
   ```

2. Run the dev server:
   ```bash
   EMAIL_CREDENTIALS="user@gmail.com:app-password" bun run dev
   ```

## Credential Setup

### Single Account

```bash
EMAIL_CREDENTIALS=user@gmail.com:app-password
```

### Multiple Accounts

```bash
EMAIL_CREDENTIALS=user1@gmail.com:pass1,user2@outlook.com:pass2,user3@yahoo.com:pass3
```

### Custom IMAP Host

For providers not auto-detected, specify the IMAP host:

```bash
EMAIL_CREDENTIALS=user@custom.com:password:imap.custom.com
```

### Outlook OAuth2 (Device Code Flow)

Outlook accounts do not use App Passwords. On first connection:
1. The server prints a device code and a Microsoft login URL
2. Open the URL in a browser and enter the code
3. Sign in with your Microsoft account and authorize
4. Tokens are saved at `~/.better-email-mcp/tokens.json`
5. Tokens refresh automatically

## Environment Variable Reference

| Variable | Required | Default | Description |
|:---------|:---------|:--------|:------------|
| `EMAIL_CREDENTIALS` | Yes (stdio) | -- | Email credentials. Format: `user@gmail.com:app-password`. Multi-account: comma-separated. Custom IMAP: `user@custom.com:pass:imap.custom.com`. |
| `TRANSPORT_MODE` | No | `stdio` | Set to `http` for remote multi-user mode. |
| `PUBLIC_URL` | Yes (http) | -- | Server's public URL for OAuth redirects. |
| `DCR_SERVER_SECRET` | Yes (http) | -- | HMAC secret for stateless Dynamic Client Registration. |
| `PORT` | No | `8080` | Server port. |
| `OUTLOOK_CLIENT_ID` | No | -- | Custom Azure AD client ID for self-hosted Outlook OAuth2. |

## Supported Providers

| Provider | Auth Method | Save-to-Sent |
|:---------|:-----------|:-------------|
| Gmail | App Password | Auto (skipped -- Gmail saves sent mail) |
| Yahoo | App Password | Auto (skipped) |
| iCloud / Me.com | App-Specific Password | Auto (skipped) |
| Outlook / Hotmail / Live | OAuth2 Device Code | IMAP APPEND |
| Zoho | App Password | IMAP APPEND |
| ProtonMail | ProtonMail Bridge | IMAP APPEND |
| Custom IMAP | Via `email:pass:imap.host` | IMAP APPEND |

## Troubleshooting

### "Authentication failed" for Gmail

- Ensure you created an **App Password**, not using your regular Google password.
- Verify 2-Step Verification is enabled on your Google account.
- The App Password format is 16 characters with no spaces.

### "Authentication failed" for Yahoo

- Create an App Password at https://login.yahoo.com/account/security/app-passwords
- Ensure "Allow apps that use less secure sign in" is not required (App Passwords bypass this).

### Outlook Device Code flow not starting

- Ensure `EMAIL_CREDENTIALS` includes an Outlook/Hotmail/Live email address (e.g., `user@outlook.com:placeholder`). The password field is ignored for Outlook -- OAuth2 handles authentication.

### "IMAP connection timeout"

- Check your internet connection.
- For custom IMAP hosts, verify the hostname and that port 993 (IMAPS) is accessible.
- Some corporate networks block IMAP. Try from a different network.

### "Relay setup page not opening"

- The relay page only appears when `EMAIL_CREDENTIALS` is not set.
- If running in Docker, ensure port mapping is correct.
- Try opening the URL manually from the terminal output.

### Multiple accounts: only one account works

- Ensure comma separation with no spaces: `user1@gmail.com:pass1,user2@yahoo.com:pass2`
- Each account must have valid credentials independently.
