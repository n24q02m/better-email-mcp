---
name: inbox-review
description: Morning inbox workflow -- multi-account scan, thread grouping, priority classification, draft replies
argument-hint: "[account or time range]"
---

# Inbox Review

Systematic morning inbox review with email-specific intelligence.

## Multi-Account Handling

Always iterate ALL configured accounts, not just the default:

```
# List accounts first
messages(action="list_accounts")

# Then search each account
messages(action="search", query="UNSEEN", account="work@company.com")
messages(action="search", query="UNSEEN", account="personal@gmail.com")
```

Never assume a single account. Users with EMAIL_CREDENTIALS containing multiple accounts expect all to be checked.

## IMAP Search Syntax

Use proper IMAP search criteria -- these are NOT free-text queries:

| Intent | Correct syntax | Wrong (will fail or return wrong results) |
|---|---|---|
| Unread emails | `UNSEEN` | `unread`, `is:unread` |
| Since a date | `SINCE 2026-03-20` | `after:2026-03-20`, `date>2026-03-20` |
| From a sender | `FROM sender@email.com` | `from:sender`, `sender@email.com` |
| Flagged/starred | `FLAGGED` | `starred`, `is:starred` |
| With subject | `SUBJECT "meeting notes"` | `subject:meeting` |
| Combine criteria | `UNSEEN SINCE 2026-03-20` | `UNSEEN AND SINCE 2026-03-20` (no AND keyword) |
| Unread + from | `UNSEEN FROM boss@co.com` | `UNSEEN AND FROM boss@co.com` |

IMAP criteria are space-separated (implicit AND). There is no explicit AND/OR keyword in basic IMAP search.

## Thread Grouping

Group messages by conversation, not individual emails:

1. Fetch unread messages
2. Group by Subject line (strip `Re:`, `Fwd:` prefixes, normalize whitespace)
3. Within each thread, sort by date ascending
4. Display thread with message count: "Meeting Q2 Planning (4 messages, latest from Alice 2h ago)"

This prevents showing 10 individual replies to the same thread as 10 separate items.

## Priority Classification

Classify based on recipient role and sender signals:

| Signal | Priority | Reasoning |
|---|---|---|
| You are in `To:` field | **Action Required** | Direct request to you |
| You are in `CC:` field | **FYI** | Informational, no action expected |
| Mailing list headers present | **Low** | Bulk/automated |
| `Reply-To` differs from `From` | **Low** | Likely automated/newsletter |
| Known sender + `To:` you directly | **High** | Personal direct message |
| `noreply@`, `notifications@` | **Low** | System notification |

## Output Format

Present results grouped by priority, not by account:

```
## Action Required (3)
- [work] "Q2 Budget Approval" from CFO (2h ago) -- needs your sign-off
- [work] "Code Review: PR #142" from Alice (5h ago) -- review requested
- [personal] "Lease Renewal" from landlord (1d ago) -- response needed

## FYI (5)
- [work] "Sprint Retro Notes" from PM (3h ago) -- CC'd, meeting summary
...

## Low Priority (12)
- [work] 8 newsletter/notification emails
- [personal] 4 promotional emails
```

For Action Required items, suggest one-line draft replies the user can approve or edit.

## When to Use

- Start of day inbox review
- Catching up after time away from email
- When inbox has accumulated many unread messages across accounts
