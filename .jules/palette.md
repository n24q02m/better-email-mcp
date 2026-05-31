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

## 2025-02-16 - Password Manager Compatibility & Semantics

**Learning:** Unconditionally setting `autocomplete="off"` on dynamic form elements severely degrades user experience by preventing password managers from working and violates accessibility guidelines (WCAG 1.3.5 Identify Input Purpose).

**Action:** Always dynamically assign semantic `autocomplete` attributes (like `email` or `current-password`) based on the input type to ensure password managers function correctly and assistive technologies understand the input's purpose.

## 2024-05-21 - Form Lock down via Fieldset

**Learning:** When submitting a dynamic form containing multiple sub-components (like "Add Account" buttons and numerous inputs), simply disabling the submit button (`<button type="submit" disabled>`) is insufficient to prevent user interaction during async loading states. Users can still modify inputs or click secondary action buttons, potentially causing corrupted state or accidental concurrent operations.

**Action:** Wrap the entire interactive section of the form (inputs, secondary buttons, submit button) in a semantic `<fieldset>` element. During async operations (like API submission), set `fieldset.disabled = true` to instantly and cleanly lock down all child form controls simultaneously, ensuring a robust and predictable loading state.

## 2025-05-24 - Form Validation with Inline Feedback

**Learning:** Relying on default HTML5 form validation popups creates an inconsistent user experience across browsers and can be challenging for screen reader users to understand contextually. Additionally, users lack immediate visual feedback on errors before submission.
**Action:** Implement custom inline form validation by overriding the default `invalid` event. Apply `aria-invalid="true"` for visual styling (e.g. red borders) and dynamically update a dedicated error message container connected to the input via `aria-describedby` (using `role="alert"` or `aria-live="polite"`) to provide accessible and immediate feedback.

## 2025-05-25 - Focus Management for Dynamic Content

**Learning:** When dynamic content like new form sections are added or removed, relying entirely on visual layout updates disrupts accessibility. If a removed element had focus, focus is typically dropped to the document `<body>`. For keyboard-only and screen reader users, this necessitates tabbing through the entire page again. Additionally, newly spawned elements aren't automatically focused.
**Action:** Implement active programmatic focus management for all dynamic content changes. When adding elements, immediately focus their primary input. When removing focused elements, explicitly return focus to the logical preceding element (e.g., the button that triggered the creation, or a 'container' wrapper) to maintain a continuous interaction flow.
## 2025-05-24 - Form Validation with Inline Feedback

**Learning:** Relying on default HTML5 form validation popups creates an inconsistent user experience across browsers and can be challenging for screen reader users to understand contextually. Additionally, users lack immediate visual feedback on errors before submission. If using `novalidate` on a form, the browser will not trigger the native `invalid` events on fields upon submission, meaning custom UI updates wired to those events will not run.

**Action:** Implement custom inline form validation. When a form uses `novalidate`, you must explicitly call `form.checkValidity()` in the form's submit event handler. If it returns false, manually trigger focus to the first invalid field (e.g. `const firstInvalid = form.querySelector('input:invalid, select:invalid, textarea:invalid'); if (firstInvalid && 'focus' in firstInvalid) (firstInvalid as HTMLElement).focus();`) and return early to allow the custom UI logic wired to the `invalid` events to display the errors appropriately.
