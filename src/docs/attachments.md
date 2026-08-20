# Attachments Tool - Full Documentation

## Overview
List and download email attachments.

## Important
- **list** returns metadata only (filename, content_type, size)
- **download** returns base64-encoded content by default
- Large attachments may consume significant tokens - check size before downloading, or use `save_to` to avoid the base64 payload entirely
- `account` and `uid` are required for all actions

## Actions

### list
List all attachments for an email.
```json
{"action": "list", "account": "user@gmail.com", "uid": 12345}
```
```json
{"action": "list", "account": "user@gmail.com", "uid": 12345, "folder": "INBOX"}
```

### download
Download a specific attachment by filename. Returns base64-encoded content.
```json
{"action": "download", "account": "user@gmail.com", "uid": 12345, "filename": "report.pdf"}
```

Pass `save_to` to write the attachment directly to a filesystem path on the
machine running the server, instead of returning `content_base64`. Useful when
the caller only needs the file on disk (e.g. an MCP client whose LLM context
would otherwise have to carry the full base64 payload) -- the response stays
small regardless of attachment size. The parent directory must already exist.
```json
{"action": "download", "account": "user@gmail.com", "uid": 12345, "filename": "report.pdf", "save_to": "/tmp/report.pdf"}
```

## Parameters
- `action` - Action to perform (required): list, download
- `account` - Account email (required)
- `uid` - Email UID (required)
- `folder` - Mailbox folder (default: INBOX)
- `filename` - Attachment filename (required for download, case-insensitive)
- `save_to` - Download only. Absolute path to write the attachment to server-side. When set, the response returns `saved_to` instead of `content_base64`.

## Response Fields

### list response
- `attachments[].filename` - Attachment filename
- `attachments[].content_type` - MIME type (e.g. application/pdf)
- `attachments[].size` - Size in bytes
- `attachments[].content_id` - Content-ID for inline attachments

### download response
- `filename` - Attachment filename
- `content_type` - MIME type
- `size` - Size in bytes
- `content_base64` - Base64-encoded file content (omitted when `save_to` was set)
- `saved_to` - Absolute path the file was written to (only present when `save_to` was set)
