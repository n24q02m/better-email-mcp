## 2024-05-14 - Data Loss Prevention & Dark Mode Contrast

**Learning:**
1. Dynamically added form elements in multi-step flows are prone to accidental clicks leading to complete data loss for that section.
2. Standard "grey" shades like `#666` used for secondary text in dark mode (background `#1a1a1a` or `#0f0f0f`) often fail WCAG AA contrast ratio requirements (4.5:1), making them inaccessible to users with low vision.

**Action:**
1. Always add a confirmation step (e.g., `confirm()`) before removing dynamically generated form segments if they contain user-entered data.
2. Use lighter greys like `#9ca3af` for secondary text against dark backgrounds to ensure adequate contrast.

## 2024-05-15 - ARIA connections for generated elements

**Learning:** When building dynamic forms with vanilla JS, helper text elements are often generated sequentially alongside inputs but lack semantic connection, causing screen readers to miss crucial instructions (like "Leave empty for auto-detection").

**Action:** Always generate a deterministic `id` for helper text elements and bind it to the associated input using `aria-describedby` immediately during creation to ensure robust accessibility.

## 2025-02-12 - Dynamic Form State Preservation

**Learning:** When dynamically rebuilding form sections based on user input (e.g., domain auto-detection), any data already entered into the targeted DOM elements will be lost if the inputs are destroyed and recreated without explicit state preservation.

**Action:** Capture the current value of the targeted inputs before rebuilding the DOM elements and reapply the captured state to the newly created inputs.

## 2025-02-13 - Visual Feedback During Long-Polling Flows

**Learning:** When an interface is waiting for an external authorization flow to complete (e.g., Microsoft OAuth device code polling), a static "Waiting..." text is easily perceived as a frozen or crashed state, causing user frustration and premature abandonment. In dark mode, `#888` text provides insufficient contrast to read clearly.

**Action:** Add subtle, continuous visual feedback (like a `.pulse` opacity animation) to elements representing indefinite wait states to reassure the user that the background process is active. Ensure waiting text contrast is WCAG compliant (e.g., `#9ca3af` on dark backgrounds).

## 2025-02-14 - Async Operation Visual Feedback

**Learning:** During potentially long-running async operations (like network requests or OAuth polling), simply changing button text (e.g., to "Connecting...") or disabling the button isn't always enough visual feedback. Users may still wonder if the system is hung, especially if the text change is subtle.

**Action:** Always include an animated visual indicator (like a CSS spinner with `aria-hidden="true"`) inside the submission button alongside the status text during asynchronous operations to clearly communicate that background processing is actively occurring.

## 2025-02-15 - Required Field Indicators for Screen Readers

**Learning:** When adding visual indicators (like `*`) for required form fields to assist sighted users, screen readers might redundantly announce "star" or "asterisk" alongside the native `required` attribute.

**Action:** Always apply `aria-hidden="true"` to visual required indicators to keep the screen reader experience clean and native.

## 2025-02-16 - Password Manager Compatibility & WCAG 1.3.5

**Learning:** Unconditionally setting `autocomplete="off"` on form inputs (especially for dynamic forms) prevents password managers from working and violates WCAG 1.3.5, which requires identifying the purpose of inputs that collect information about the user.

**Action:** Conditionally apply the `autocomplete` attribute based on the input type. For instance, use `autocomplete="email"` for email fields and `autocomplete="current-password"` for password fields to support password managers and comply with accessibility standards.
