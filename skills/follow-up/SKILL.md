---
name: follow-up
description: Find emails needing follow-up -- unanswered sent emails, flagged unreplied, draft contextual responses
argument-hint: "[days since sent] or [account]"
---

# Follow-Up

Find emails that need follow-up and draft contextual responses.

## Unanswered Sent Emails

Find emails you sent that received no reply after N days:

1. **Search Sent folder** for emails sent N+ days ago:
   ```
   messages(action="search", query="SINCE 2026-03-16 BEFORE 2026-03-20", folder="Sent", account="...")
   ```

2. **Cross-reference Inbox** for replies:
   - For each sent email, search Inbox for matching Subject (with `Re:` prefix):
     `messages(action="search", query="SUBJECT \"Re: <original subject>\" FROM <recipient>")`
   - If no matching reply found, this email needs follow-up

3. **Present candidates** with context:
   ```
   No reply after 5 days:
   1. "API Integration Proposal" to partner@company.com (sent Mar 18)
      Original: Asked about timeline for API access
   2. "Invoice #2024-003" to client@business.com (sent Mar 16)
      Original: Sent invoice, requested payment confirmation
   ```

## Flagged but Unreplied

Find received emails you flagged/starred but never responded to:

```
messages(action="search", query="FLAGGED", account="...")
```

Then for each flagged email, check Sent folder for a reply with matching subject. If none found, it needs attention.

## Drafting Follow-Up Messages

For each follow-up candidate:

1. **Read the original thread** to get full context
2. **Decide reply type**:
   - If original was your sent email with no reply: draft a gentle follow-up referencing the original
   - If original was received and you haven't replied: draft a response to their message
3. **Use reply (not new message)** when following up on existing threads:
   ```
   send(action="reply", message_id="<original_msg_id>", body="<follow-up text>")
   ```
   Only use `send(action="send")` for new conversations.

4. **Follow-up tone guidelines**:
   - First follow-up (3-5 days): "Just checking in on this..."
   - Second follow-up (7-10 days): "Wanted to circle back on..."
   - Final follow-up (14+ days): Direct ask with deadline: "Could you confirm by Friday?"

## Multi-Account Handling

Check all accounts, same as inbox-review:

```
messages(action="list_accounts")
# Iterate each account's Sent folder
```

## When to Use

- Weekly follow-up review (e.g., Friday afternoon)
- Before meetings -- check if pending items got responses
- When a specific sent email seems to have been ignored
- Clearing out flagged emails that accumulated
