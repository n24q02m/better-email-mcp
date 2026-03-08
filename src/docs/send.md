# Send Tool - Full Documentation

## Overview
Send new emails, reply to threads, and forward emails via SMTP.

## Important
- **reply** automatically sets In-Reply-To and References headers for threading
- **forward** includes original email body with separator
- `account` specifies which configured email to send from
- HTML is auto-generated from plain text body (basic markdown support)

## Actions

### new
Send a new email.
```json
{"action": "new", "account": "user@gmail.com", "to": "recipient@example.com", "subject": "Hello", "body": "Hi there!"}
```
```json
{"action": "new", "account": "user@gmail.com", "to": "a@example.com", "subject": "Update", "body": "See details.", "cc": "b@example.com", "bcc": "c@example.com"}
```

### reply
Reply to an email. Reads original email to set threading headers.
```json
{"action": "reply", "account": "user@gmail.com", "to": "sender@example.com", "body": "Thanks!", "uid": 12345}
```
```json
{"action": "reply", "account": "user@gmail.com", "to": "sender@example.com", "subject": "Re: Custom subject", "body": "Got it.", "uid": 12345, "folder": "INBOX"}
```

### forward
Forward an email. Original body is appended with separator.
```json
{"action": "forward", "account": "user@gmail.com", "to": "colleague@example.com", "body": "FYI, see below.", "uid": 12345}
```

## Parameters
- `action` - Action to perform (required): new, reply, forward
- `account` - Sender account email (required)
- `to` - Recipient email address (required)
- `subject` - Email subject (required for new, optional for reply/forward)
- `body` - Email body text (required)
- `cc` - CC recipients (comma-separated, optional)
- `bcc` - BCC recipients (comma-separated, optional)
- `uid` - Original email UID (required for reply/forward)
- `folder` - Folder of original email (default: INBOX, for reply/forward)

## Response Fields
- `saved_to_sent` - Whether the sent message was saved to the Sent folder via IMAP APPEND

## Save-to-Sent Behavior
After sending, the server saves a copy to the Sent folder via IMAP APPEND.
- **Gmail, Yahoo, iCloud**: Skipped (these providers auto-save sent messages; APPEND would create duplicates)
- **Outlook, Zoho, Fastmail, and others**: Saved via IMAP APPEND (best-effort, silent failure)
- `saved_to_sent: false` means either the provider auto-saves or the IMAP save was skipped/failed

## Provider Compatibility
| Provider | Auth Method | Save-to-Sent |
|----------|------------|-------------|
| Gmail | App Password | Auto (skipped) |
| Yahoo | App Password | Auto (skipped) |
| iCloud | App-Specific Password | Auto (skipped) |
| Outlook.com | OAuth2 (Device Code flow) | IMAP APPEND |
| Zoho Mail | App Password | IMAP APPEND |
| Fastmail | App Password | IMAP APPEND |
| ProtonMail | Not supported (requires Bridge) | N/A |

## Outlook OAuth2 Setup
Outlook.com/Hotmail/Live accounts require OAuth2 (Microsoft deprecated app passwords).

**One-time setup:**
```bash
npx @n24q02m/better-email-mcp auth user@outlook.com
```

This opens a browser for Microsoft sign-in. Tokens are saved to `~/.better-email-mcp/tokens.json`.
After setup, use `EMAIL_CREDENTIALS` as usual — OAuth2 is automatic.

**Requirements:**
- `OUTLOOK_CLIENT_ID` env var (Azure AD app client ID, provided by server operator)
- Azure AD app: "Accounts in any organizational directory and personal Microsoft accounts"
- API permissions: Microsoft Graph > Delegated > `IMAP.AccessAsUser.All`, `SMTP.Send`
- Authentication > Advanced settings: Enable "Allow public client flows"
- Tokens auto-refresh (access token: 1h, refresh token: 90-day sliding window)

## Notes
- Reply subject auto-prepends "Re:" if not already present
- Forward subject auto-prepends "Fwd:" if not already present
- Body supports basic markdown: `# heading`, `## heading`, `- list item`, `**bold**`
