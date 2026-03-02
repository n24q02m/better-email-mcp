## 2024-05-27 - Insecure SMTP Configuration (Missing Enforced TLS)
**Vulnerability:** SMTP configurations utilizing STARTTLS (port 587) lacked `requireTLS: true` in their configuration settings.
**Learning:** Relying purely on `secure: false` over port 587 allows for implicit usage of STARTTLS but exposes the connection to downgrade attacks where a Man-in-the-Middle attacker can strip the STARTTLS command, resulting in plaintext transmission.
**Prevention:** Always enforce TLS on STARTTLS connections by explicitly setting `requireTLS: true` when `secure: false` is used on port 587.
