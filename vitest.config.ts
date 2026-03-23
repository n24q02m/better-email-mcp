import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: ['build/**', 'node_modules/**', 'bin/**', 'tests/live/**'],
    coverage: {
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      exclude: ['node_modules/', 'build/', 'bin/']
    }
  }
})
