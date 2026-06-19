1. **Add `@media (prefers-reduced-motion: reduce)` rules for animations in `src/credential-form.ts`.**
   - In `renderStyles()`, update the CSS block to include `prefers-reduced-motion: reduce` for `.pulse` and `.spinner` so animations are disabled (`animation: none;`) if the user prefers reduced motion.

2. **Verify changes visually and functionally.**
   - Start the local dev server.
   - Run a Playwright script to screenshot the rendered credential form to ensure visual continuity.

3. **Complete pre-commit checks.**
   - Run the pre commit tool.

4. **Submit changes.**
   - Submit the branch with a Conventional Commits title (e.g., `[UX]`).
