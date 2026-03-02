## 2025-03-02 - Insecure SMTP Configuration (Missing Enforced TLS)
**Vulnerability:** Nodemailer transport configurations using `secure: false` (STARTTLS) were missing `requireTLS: true`.
**Learning:** Using `secure: false` relies on STARTTLS, which can be stripped by a Man-in-the-Middle (MITM) attacker, allowing emails (including credentials and content) to be transmitted in plain text.
**Prevention:** Always include `requireTLS: true` when configuring Nodemailer transports with `secure: false` for providers using STARTTLS (like Outlook and iCloud) to prevent TLS downgrade attacks.
