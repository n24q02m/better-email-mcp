1. *Update `formatAddress` in `src/tools/helpers/imap-client.ts` to improve robustness and remove redundant type annotations.*
   - Remove the redundant `: EmailAddress` annotation in the `map` callback.
   - Refactor the logic to handle missing `address` by returning `a.name`, ensuring no `"undefined"` strings are produced (e.g., when `a.name` is present but `a.address` is not).
   - Add support for recursive formatting of address groups if present in `EmailAddress.group`.
2. *Clean up unsafe casts and redundant type annotations in `searchEmails` within `src/tools/helpers/imap-client.ts`.*
   - Remove the `as FetchMessageObject[]` cast on the `emails` variable and ensure it is correctly typed (either via inference or explicit type parameter to `withConnection`).
   - Remove the redundant `: FetchMessageObject` annotation in the `mapLimit` callback.
3. *Clean up `any` types and improve type safety in `src/tools/helpers/imap-client.test.ts`.*
   - Update imports to include `ParsedMail` and `FetchMessageObject`.
   - Update `setupReadEmail` to accept `Partial<ParsedMail>` instead of `Record<string, any>`.
   - Replace multiple `as any` casts with `as unknown as ParsedMail` or appropriate types, focusing on `mockSimpleParser.mockResolvedValue` calls.
   - Fix the `as any` in the mock iterator's `next()` method by using a safer alternative.
4. *Run the full test suite using `bun run test` to verify the changes and ensure no regressions.*
5. *Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.*
6. *Submit the change.*
