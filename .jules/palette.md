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
## 2024-05-18 - Improve accessibility of code copying
**Learning:** Adding a copy button for codes displayed in UI improves accessibility and usability.
**Action:** Always provide a copy mechanism when user needs to copy code displayed on the screen.

## 2025-02-18 - Password Field Masking

**Learning:** Masked password fields (e.g., `type="password"`) help prevent shoulder-surfing, but they can be inaccessible for users with cognitive or motor disabilities who may struggle with typing accuracy and cannot verify their input.
**Action:** Always provide a "Show/Hide" toggle button for password input fields. Ensure the button has an accessible name (e.g., `aria-label="Show password as plain text"`) that updates dynamically when the state changes.
## 2025-03-09 - [Accessibility Enhancements to credential-form.ts]
**Learning:** When using Playwright in a headless Chromium environment to test clipboard interactions (like `navigator.clipboard.writeText`), the clipboard promise may silently fail or hang unless explicit permissions (`clipboard-read`, `clipboard-write`) are granted to the browser context, or the API is directly mocked in the page context.
**Action:** When writing Playwright tests involving clipboard copies, either mock the clipboard API via `page.evaluate("navigator.clipboard.writeText = function() { return Promise.resolve(); };")` or initialize the context with the required permissions.
## 2024-05-19 - [Dynamic Form Focus Management]
**Learning:** When removing an interactive element (like an account card) from a dynamic list in the DOM, abruptly dropping keyboard focus to a fallback action button at the bottom of the page creates a jarring navigation experience. Screen reader and keyboard users lose their context within the form list.
**Action:** Always attempt to return focus to a logical sibling (e.g. the previous or next card's first input field) before falling back to global action buttons like "Add New". This maintains the sequential flow of form completion.
## 2025-02-19 - ARIA Pressed State for Password Toggles
**Learning:** Screen reader users need clear context when toggling the visibility of password fields. While changing the button text or `aria-label` provides information, using `aria-pressed` robustly announces the toggled state to screen readers, improving the cognitive context of the action.
**Action:** Always include the `aria-pressed` attribute (toggling between `true` and `false`) on "Show/Hide" password buttons to announce their active state reliably to screen readers.
## 2026-06-29 - [Dynamic Account Card Titles and ARIA Labels]
**Learning:** For forms involving multiple dynamic instances of the same component grouping (e.g. "Account 1", "Account 2"), hardcoded titles and generic ARIA labels like "Remove Account 2" lack context for screen reader users and can be confusing. Dynamically binding the user's entered email address to the section title and the removal button's ARIA label significantly improves context and usability.
**Action:** When creating repeatable form structures, identify the primary input (like a name or email address) and bind it to the container's title and the ARIA labels of related action buttons (like Remove or Edit). Ensure long text is truncated gracefully using CSS (`text-overflow: ellipsis`) so layout doesn't break.
## 2026-06-30 - Preventing unnecessary DOM rebuilds
**Learning:** When dynamic forms are updated on every keystroke, aggressively destroying and rebuilding DOM nodes based on a substring (like an email domain) causes unnecessary churn. This resets transient user interface states—such as the visibility toggle of a password field—when the user is simply correcting a typo in the prefix.
**Action:** Implement category-based change detection (e.g., categorizing the input into 'oauth', 'app-password', or 'custom' domains). Only rebuild the related DOM nodes when the abstract category changes, preserving transient state for minor edits within the same category.

## 2026-06-30 - Review Feedback: Avoid adding unused dependencies
**Learning:** During UI testing in CI or agent environments, avoid adding heavy dependencies like `playwright` to the project's permanent `package.json` unless explicitly requested. Adding them can bloat the project and violate boundaries.
**Action:** Always install temporary testing dependencies without saving them to `package.json` (e.g., using `--no-save` or rolling back changes with `git checkout -- package.json bun.lock`), or use standalone scripts that don't pollute the project's dependency tree.
## 2025-07-03 - [Account Cards Group Accessibility]
**Learning:** Screen reader users lose context when navigating deeply nested repeatable sections if those sections aren't logically grouped with accessible names. Form fields like 'Email' inside 'Account 2' might just be announced as 'Email' unless the container is properly structured as a group.
**Action:** When creating repeatable form sections (like account cards), use `role="group"` on the container and `aria-labelledby` pointing to the section's dynamic title ID. This ensures the section title is announced along with its child form controls.
