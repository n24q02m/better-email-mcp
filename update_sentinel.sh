#!/bin/bash
cat << 'MARKDOWN_EOF' >> .jules/sentinel.md
## 2026-07-26 - XSS Vector via Null Bytes in isSafeUrl (XPIA Vector)
**Vulnerability:** The `isSafeUrl` function used by the system correctly blocked `javascript:` and other unsafe schemes. However, it was vulnerable to bypasses using null bytes (`\0`) within or preceding the scheme. Attackers could craft URLs like `javascript\0:alert(1)` or `\0javascript:alert(1)` which might bypass the string matching or parsing checks while still being executed as active scripts by some contexts or engines downstream.
**Learning:** Checking for exact string prefixes without accounting for control characters like null bytes that might be ignored or stripped by downstream consumers leaves parsing vulnerabilities. The `URL` constructor in JS may sometimes behave differently from browser navigation contexts when encountering control characters.
**Prevention:** Explicitly check for and reject null bytes (`\0`) in user-provided URLs before parsing or validating them for security constraints.
MARKDOWN_EOF
