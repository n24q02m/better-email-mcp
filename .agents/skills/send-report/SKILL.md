---
name: send-report
description: Template-based email report — select template, fill fields, preview, send
argument-hint: "[report type]"
---

# Send Report

Compose and send a structured email report using templates.

## Steps

1. **Identify report type**:
   - Status update, weekly summary, incident report, project review
   - Ask user for specific content and recipients

2. **Compose email**:
   - Structure with clear sections (Summary, Details, Next Steps, Action Items)
   - Use HTML formatting for readability:
     `send(action="send", to="<recipients>", subject="<subject>", html="<formatted content>")`

3. **Add attachments** if needed:
   - `attachments(action="list")` to see available files
   - Include relevant documents or data exports

4. **Preview and send**:
   - Show draft to user for review
   - Send after confirmation: `send(action="send", ...)`

5. **Confirm delivery** and report status.

## When to Use

- Sending regular status updates to stakeholders
- Distributing meeting notes or summaries
- Sending incident reports or post-mortems
- Sharing project documentation via email
