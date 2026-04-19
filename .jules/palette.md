## 2024-04-19 - Accessible Loading States for Buttons
**Learning:** For asynchronous submission buttons, simply disabling them and changing text (e.g. to "Connecting...") is not fully accessible. Screen readers benefit significantly from the `aria-busy` attribute, which provides essential processing state feedback to assistive technologies.
**Action:** Always combine native `disabled` attributes with `aria-busy="true"` on submit buttons when awaiting server responses, and `removeAttribute("aria-busy")` or set it to false when the request is complete, regardless of success or failure.
