import { describe, expect, it } from 'vitest'
import { wrapOperationError } from '../src/tools/helpers/errors.js'

describe('error propagation', () => {
  it('preserves the underlying cause instead of collapsing to "Command failed"', () => {
    const underlying = new Error('ETIMEDOUT: connection timed out after 30000ms')
    const wrapped = wrapOperationError('listMessages', underlying)

    expect(wrapped.message).not.toBe('Command failed')
    expect(wrapped.message).toContain('listMessages')
    expect(wrapped.message).toContain('ETIMEDOUT')
    expect(wrapped.cause).toBe(underlying)
  })

  it('never emits a bare "Command failed" message', () => {
    const underlying = new Error('')
    const wrapped = wrapOperationError('fetchFolder', underlying)

    expect(wrapped.message).not.toBe('Command failed')
    expect(wrapped.message).toContain('fetchFolder')
  })

  it(
    'has no source file that throws a bare "Command failed"',
    async () => {
      const { execSync } = await import('node:child_process')
      const hits = execSync('git grep -n "Command failed" -- "src/*.ts" || true', {
        encoding: 'utf8'
      }).trim()

      expect(hits).toBe('')
    },
    15_000
  )
})
