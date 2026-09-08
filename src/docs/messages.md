# Messages Tool - Full Documentation

## Overview
Email messages: search, read, mark_read, mark_unread, flag, unflag, move, archive, trash, new, reply, forward.

## Important
- **read** returns the full clean plain-text body by default (HTML stripped for LLM token savings)
- Set `preview: true` for a bounded body preview. Preview responses include `body_truncated`, `body_char_count`, and `body_limit`; `max_chars` defaults to 4000 and is capped at 100000.
- **UIDs are per-account and per-folder** - always specify account for modify operations
- Query language supports compound filters: `UNREAD SINCE 2024-01-01`
- **reply** automatically sets In-Reply-To and References headers for threading
- **forward** includes the original email body with a separator
- Outbound bodies support plain text or HTML; do not mix both

## Actions

### search
Search emails across all or filtered accounts.
```json
{"action": "search", "query": "UNREAD", "folder": "INBOX", "limit": 20}
```
```json
{"action": "search", "query": "UNREAD SINCE 2024-06-01", "account": "user@gmail.com"}
```
```json
{"action": "search", "query": "FROM boss@company.com", "limit": 5}
```

Query shortcuts:
- `UNREAD` / `UNSEEN` - unread emails
- `READ` / `SEEN` - read emails
- `FLAGGED` / `STARRED` - flagged emails
- `ALL` / `*` - all emails
- `SINCE YYYY-MM-DD` - emails after date
- `FROM email` - emails from sender
- `SUBJECT text` - emails matching subject
- `UNREAD SINCE YYYY-MM-DD` - compound filter
- `UNREAD FROM email` - compound filter
- Any other text is treated as subject search

### read
Read a single email by UID. Omit `preview` for the full clean body, or set `preview: true` for a bounded response.
```json
{"action": "read", "account": "user@gmail.com", "uid": 12345, "folder": "INBOX"}
```
```json
{"action": "read", "account": "user@gmail.com", "uid": 12345, "preview": true, "max_chars": 4000}
```
Preview responses retain the message metadata and return:
- `body_truncated` - whether the body was shortened
- `body_char_count` - full body length in characters
- `body_limit` - applied preview limit

### mark_read
```json
{"action": "mark_read", "account": "user@gmail.com", "uids": [123, 456, 789]}
```

### mark_unread
```json
{"action": "mark_unread", "account": "user@gmail.com", "uid": 123}
```

### flag
Star/flag emails.
```json
{"action": "flag", "account": "user@gmail.com", "uids": [123, 456]}
```

### unflag
Remove star/flag from emails.
```json
{"action": "unflag", "account": "user@gmail.com", "uid": 123}
```

### move
Move emails to another folder.
```json
{"action": "move", "account": "user@gmail.com", "uids": [123], "destination": "[Gmail]/Important"}
```

### archive
Archive emails (auto-detects archive folder per provider).
```json
{"action": "archive", "account": "user@gmail.com", "uids": [123, 456]}
```

### trash
Delete emails (moves to trash).
```json
{"action": "trash", "account": "user@gmail.com", "uid": 123}
```

### new
Send a new email via SMTP.
```json
{"action": "new", "account": "user@gmail.com", "to": "recipient@example.com", "subject": "Hello", "body": "Hi there!"}
```
```json
{"action": "new", "account": "user@gmail.com", "to": "a@example.com", "subject": "Update", "body": "See details.", "cc": "b@example.com", "bcc": "c@example.com"}
```

### reply
Reply to an email. Reads the original email to set threading headers and auto-derives the recipient when `to` is omitted.
```json
{"action": "reply", "account": "user@gmail.com", "body": "Thanks!", "uid": 12345}
```
```json
{"action": "reply", "account": "user@gmail.com", "to": "sender@example.com", "subject": "Re: Custom subject", "body": "Got it.", "uid": 12345, "folder": "INBOX"}
```

### forward
Forward an email. The original body is appended with a separator.
```json
{"action": "forward", "account": "user@gmail.com", "to": "colleague@example.com", "body": "FYI, see below.", "uid": 12345}
```

- `action` - Action to perform (required)
- `account` - Account email filter (optional for search, required for modify)
- `query` - Search query string (default: UNSEEN)
- `folder` - Mailbox folder (default: INBOX)
- `limit` - Max search results (default: 20)
- `uid` - Single email UID
- `preview` - Return a bounded body preview for read (default: false)
- `max_chars` - Preview body limit, integer 1-100000 (default: 4000 when preview is true)
- `uids` - Multiple email UIDs for batch operations
- `destination` - Target folder for move action
- `to` - Recipient email address (required for new/forward, optional for reply)
- `subject` - Email subject (required for new, optional for reply/forward)
- `body` - Email body (required for new/reply/forward)
- `cc` - CC recipients (comma-separated, optional)
- `bcc` - BCC recipients (comma-separated, optional)
- `attachments` - Base64 file attachments, max 10 files and 25MB decoded total

## Outbound response and provider behavior

- `saved_to_sent` reports whether the sent message was saved to the Sent folder via IMAP APPEND.
- Gmail, Yahoo, and iCloud auto-save sent messages, so IMAP APPEND is skipped.
- Outlook, Zoho, Fastmail, and other providers use best-effort IMAP APPEND.
- Outlook.com/Hotmail/Live accounts use OAuth2 automatically; the first use may return a sign-in link and code, and tokens refresh silently.
- Reply subjects are prefixed with `Re:` when needed; forward subjects are prefixed with `Fwd:` when needed.
- Bodies support basic markdown such as headings, lists, and bold text.
