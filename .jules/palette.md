## 2024-05-14 - Data Loss Prevention & Dark Mode Contrast

**Learning:**
1. Dynamically added form elements in multi-step flows are prone to accidental clicks leading to complete data loss for that section.
2. Standard "grey" shades like `#666` used for secondary text in dark mode (background `#1a1a1a` or `#0f0f0f`) often fail WCAG AA contrast ratio requirements (4.5:1), making them inaccessible to users with low vision.

**Action:**
1. Always add a confirmation step (e.g., `confirm()`) before removing dynamically generated form segments if they contain user-entered data.
2. Use lighter greys like `#9ca3af` for secondary text against dark backgrounds to ensure adequate contrast.

## 2026-04-22 - Form Helper Text Accessibility

**Learning:**
Dynamically generated form helper text (like instructions for App Passwords) is completely invisible to screen readers when navigating between input fields unless explicitly linked.
**Action:**
Always assign a unique `id` to dynamic `<p>` or `<span>` helper elements and link them to their corresponding `<input>` using the `aria-describedby` attribute to guarantee the instructions are announced when the input receives focus.
