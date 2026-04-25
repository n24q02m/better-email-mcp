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

## 2024-05-16 - Dynamic Notification Accessibility & Contrast

**Learning:** When generating dynamic form elements that act as notifications (like an OAuth notice that appears when a user types a specific email domain), screen readers won't announce the new content automatically. Furthermore, secondary text using `#888` on a dark background fails WCAG AA contrast guidelines.

**Action:** Always apply `role="status"` and `aria-live="polite"` to dynamic notification containers so screen readers announce their appearance. Use `#9ca3af` instead of `#888` for secondary text to ensure sufficient contrast.
