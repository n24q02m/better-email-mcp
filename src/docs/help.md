# Help Tool - Full Documentation

## Overview

Get full documentation for any email MCP tool. Returns detailed usage instructions, parameter descriptions, and examples.

## Important

- Use when the compressed tool description is insufficient
- Returns markdown documentation for the requested tool
- Available for: messages, folders, attachments, send

## Actions

This tool has no `action` parameter — it takes only `tool_name`.

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| tool_name | string | Yes | Tool to get documentation for |

## Valid tool_name values

- `messages` — Search, read, and manage email messages
- `folders` — List mailbox folders
- `attachments` — List and download email attachments
- `send` — Send, reply, and forward emails
- `help` — This documentation

## Examples

### Get documentation for the messages tool

```json
{
  "tool_name": "messages"
}
```

### Get documentation for the send tool

```json
{
  "tool_name": "send"
}
```

## Response Format

```json
{
  "tool": "messages",
  "documentation": "# Messages Tool - Full Documentation\n..."
}
```
