## 2024-04-16 - Add contextual ARIA labels to repeatable UI components
**Learning:** Generic action buttons (e.g., "Remove") in dynamic, repeatable lists (like form arrays or account lists) lack context for screen reader users when multiple instances exist on the page.
**Action:** Always inject contextual state (like the current item's index or name) into the `aria-label`s of generic action buttons (e.g., `aria-label="Remove Account 1"`) to preserve accessibility context for screen readers.
