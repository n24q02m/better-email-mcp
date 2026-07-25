import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/live/**/*.test.ts'],
    exclude: ['build/**', 'node_modules/**', 'bin/**'],
    // Every file here spawns a real server process and opens real IMAP/SMTP
    // connections against one mailbox. Run in parallel they raced each other —
    // the 15s connect hook timed out — so keep the live suite serial.
    fileParallelism: false,
    hookTimeout: 30_000
  }
})
