import { describe, expect, test } from 'vitest'
import type { EmailSubjectScope } from './subject-context.js'
import { subjectContext } from './subject-context.js'

describe('subjectContext', () => {
  test('should be undefined by default', () => {
    expect(subjectContext.getStore()).toBeUndefined()
  })

  test('should provide scope within run()', () => {
    const scope: EmailSubjectScope = {
      sub: 'user-1',
      accounts: []
    }

    subjectContext.run(scope, () => {
      expect(subjectContext.getStore()).toBe(scope)
    })

    expect(subjectContext.getStore()).toBeUndefined()
  })

  test('should maintain scope across async boundaries', async () => {
    const scope: EmailSubjectScope = {
      sub: 'user-async',
      accounts: []
    }

    await subjectContext.run(scope, async () => {
      expect(subjectContext.getStore()).toBe(scope)
      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(subjectContext.getStore()).toBe(scope)
    })
  })

  test('should isolate concurrent scopes', async () => {
    const scopeA: EmailSubjectScope = { sub: 'a', accounts: [] }
    const scopeB: EmailSubjectScope = { sub: 'b', accounts: [] }

    const runA = subjectContext.run(scopeA, async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(subjectContext.getStore()).toBe(scopeA)
      return 'a'
    })

    const runB = subjectContext.run(scopeB, async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(subjectContext.getStore()).toBe(scopeB)
      return 'b'
    })

    const results = await Promise.all([runA, runB])
    expect(results).toEqual(['a', 'b'])
  })

  test('should support nested scopes', () => {
    const outerScope: EmailSubjectScope = { sub: 'outer', accounts: [] }
    const innerScope: EmailSubjectScope = { sub: 'inner', accounts: [] }

    subjectContext.run(outerScope, () => {
      expect(subjectContext.getStore()).toBe(outerScope)

      subjectContext.run(innerScope, () => {
        expect(subjectContext.getStore()).toBe(innerScope)
      })

      expect(subjectContext.getStore()).toBe(outerScope)
    })
  })

  test('should restore store after synchronous error', () => {
    const scope: EmailSubjectScope = { sub: 'sync-error', accounts: [] }

    expect(() => {
      subjectContext.run(scope, () => {
        expect(subjectContext.getStore()).toBe(scope)
        throw new Error('sync error')
      })
    }).toThrow('sync error')

    expect(subjectContext.getStore()).toBeUndefined()
  })

  test('should restore store after asynchronous error', async () => {
    const scope: EmailSubjectScope = { sub: 'async-error', accounts: [] }

    await expect(
      subjectContext.run(scope, async () => {
        expect(subjectContext.getStore()).toBe(scope)
        await new Promise((resolve) => setTimeout(resolve, 10))
        throw new Error('async error')
      })
    ).rejects.toThrow('async error')

    expect(subjectContext.getStore()).toBeUndefined()
  })
})
