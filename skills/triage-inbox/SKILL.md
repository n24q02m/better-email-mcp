---
name: triage-inbox
description: Email inbox triage — fetch unread, categorize by priority, draft replies for urgent items
argument-hint: "[account or folder]"
---

# Triage Inbox

Systematically process unread emails, categorize by priority, and draft responses.

## Steps

1. **Fetch unread emails**:
   - `messages(action="search", query="UNREAD", max_results=20)`
   - Or filter by account: `messages(action="search", query="UNREAD", account="work")`

2. **Categorize by priority**:
   - **Urgent**: Direct requests, deadlines, escalations
   - **Important**: Project updates, reviews needed, team communications
   - **Low**: Newsletters, notifications, automated emails
   - **Archive**: Spam, irrelevant, already handled

3. **Process each category**:
   - Urgent: Draft replies, flag for follow-up
   - Important: Mark for later, add brief notes
   - Low: Read summaries only
   - Archive: `messages(action="archive", message_id="<id>")`

4. **Draft replies** for urgent items:
   - `send(action="draft", to="<sender>", subject="Re: <subject>", body="<draft>")`
   - Or send directly if user approves

5. **Summary report**: Present triage results organized by priority.

## When to Use

- Morning inbox review routine
- After being away from email for a while
- When inbox has accumulated many unread messages
- Regular inbox maintenance
