# Folders Tool - Full Documentation

## Overview
List mailbox folders for one or all email accounts.

## Important
- Returns folder **names, paths, flags, and children**
- Gmail uses labels (e.g. `[Gmail]/All Mail`, `[Gmail]/Trash`)
- Outlook uses standard folders (Inbox, Sent, Drafts, Archive, Junk)
- Folder paths are case-sensitive

## Actions

### list
List all folders for all accounts or a specific account.
```json
{"action": "list"}
```
```json
{"action": "list", "account": "user@gmail.com"}
```

## Parameters
- `action` - Action to perform (required): list
- `account` - Account email filter (optional, defaults to all)

## Common Folder Names

### Gmail
- `INBOX`
- `[Gmail]/All Mail`
- `[Gmail]/Drafts`
- `[Gmail]/Important`
- `[Gmail]/Sent Mail`
- `[Gmail]/Spam`
- `[Gmail]/Starred`
- `[Gmail]/Trash`

### Outlook
- `Inbox`
- `Sent`
- `Drafts`
- `Archive`
- `Junk`
- `Deleted`
