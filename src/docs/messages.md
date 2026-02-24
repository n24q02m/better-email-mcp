# Messages Tool - Full Documentation

## Overview
Email messages: search, read, mark_read, mark_unread, flag, unflag, move, archive, trash.

## Important
- **search** defaults to all configured accounts. Filter with `account` param.
- **read** returns clean plain text body (HTML stripped for LLM token savings)
- **UIDs are per-account and per-folder** - always specify account for modify operations
- Query language supports compound filters: `UNREAD SINCE 2024-01-01`

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
Read a single email by UID. Returns full body as clean text.
```json
{"action": "read", "account": "user@gmail.com", "uid": 12345, "folder": "INBOX"}
```

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

## Parameters
- `action` - Action to perform (required)
- `account` - Account email filter (optional for search, required for modify)
- `query` - Search query string (default: UNSEEN)
- `folder` - Mailbox folder (default: INBOX)
- `limit` - Max search results (default: 20)
- `uid` - Single email UID
- `uids` - Multiple email UIDs for batch operations
- `destination` - Target folder for move action
