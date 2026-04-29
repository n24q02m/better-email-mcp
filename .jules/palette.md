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

## 2025-02-15 - Required Field Indicators and Aria-Hidden

**Learning:** When generating dynamic forms, marking optional fields is helpful, but relying purely on the absence of an "Optional" badge for required fields is ambiguous for sighted users. However, injecting a literal `*` without `aria-hidden="true"` causes screen readers to redundantly announce "star" or "asterisk" when the input itself is already marked `required`.
**Action:** Always include a visual required indicator (like `*`) in red (with sufficient contrast) for sighted users, but explicitly hide it from screen readers using `aria-hidden="true"` to prevent double-announcements when the native input `required` attribute already handles accessibility semantics.
