import { describe, expect, test } from 'vitest'
import type { EmailSubjectScope } from './subject-context.js'
import { currentSub, subjectContext } from './subject-context.js'

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

  test('should preserve all fields in AccountConfig', () => {
    const scope: EmailSubjectScope = {
      sub: 'full-scope',
      accounts: [
        {
          id: 'acc-1',
          email: 'user@example.com',
          password: 'password',
          authType: 'password',
          imap: { host: 'imap.example.com', port: 993, secure: true },
          smtp: { host: 'smtp.example.com', port: 465, secure: true }
        }
      ]
    }

    subjectContext.run(scope, () => {
      const stored = subjectContext.getStore()
      expect(stored).toBeDefined()
      expect(stored?.accounts).toHaveLength(1)
      expect(stored?.accounts[0]).toEqual(scope.accounts[0])
      expect(stored?.accounts[0].email).toBe('user@example.com')
      expect(stored?.accounts[0].authType).toBe('password')
    })
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

describe('currentSub', () => {
  test('returns the sub inside a subjectContext scope', async () => {
    await subjectContext.run({ sub: 'sub-x', accounts: [] }, async () => {
      expect(currentSub()).toBe('sub-x')
    })
  })

  test('returns null outside any scope (detached background poll)', () => {
    expect(currentSub()).toBeNull()
  })

  test('reflects the innermost nested scope', () => {
    subjectContext.run({ sub: 'outer', accounts: [] }, () => {
      expect(currentSub()).toBe('outer')
      subjectContext.run({ sub: 'inner', accounts: [] }, () => {
        expect(currentSub()).toBe('inner')
      })
      expect(currentSub()).toBe('outer')
    })
  })

  test('defensive check: returns null if the store is incorrectly a primitive string', () => {
    // @ts-expect-error - simulating a case where the store is incorrectly populated with a string
    subjectContext.run('not-an-object', () => {
      const result = currentSub()
      // If result is String.prototype.sub, it will be a function
      expect(typeof result).not.toBe('function')
      expect(result).toBeNull()
    })
  })

  test('defensive check: returns null if the store is missing the sub property', () => {
    // @ts-expect-error
    subjectContext.run({ accounts: [] }, () => {
      expect(currentSub()).toBeNull()
    })
  })

  test('defensive check: returns null if the sub property is not a string', () => {
    // @ts-expect-error
    subjectContext.run({ sub: 123, accounts: [] }, () => {
      expect(currentSub()).toBeNull()
    })
  })

  test('defensive check: returns null if the store is null', () => {
    // @ts-expect-error
    subjectContext.run(null, () => {
      expect(currentSub()).toBeNull()
    })
  })
})
