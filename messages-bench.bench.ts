import { bench, describe } from 'vitest'

const mockFolders = Array.from({ length: 100 }, (_, i) => ({
  path: `Folder ${i}`,
  flags: ['\\Draft', '\\Important', '\\HasNoChildren']
}))

mockFolders.push({
  path: 'Archive',
  flags: ['\\Archive', '\\All']
})

describe('Archive flag finding', () => {
  bench('current regex loop', () => {
    mockFolders.find((f) => {
      if (/archive|all mail/i.test(f.path)) {
        return true
      }
      for (let i = 0; i < f.flags.length; i++) {
        if (/archive|all/i.test(f.flags[i])) return true
      }
      return false
    })
  })

  bench('native includes/some', () => {
    mockFolders.find((f) => {
      const lowerPath = f.path.toLowerCase()
      if (lowerPath.includes('archive') || lowerPath.includes('all mail')) {
        return true
      }
      for (let i = 0; i < f.flags.length; i++) {
        const lowerFlag = f.flags[i].toLowerCase()
        if (lowerFlag.includes('archive') || lowerFlag.includes('all')) return true
      }
      return false
    })
  })

  bench('pre-compiled regex', () => {
    const pathRegex = /archive|all mail/i
    const flagRegex = /archive|all/i
    mockFolders.find((f) => {
      if (pathRegex.test(f.path)) {
        return true
      }
      for (let i = 0; i < f.flags.length; i++) {
        if (flagRegex.test(f.flags[i])) return true
      }
      return false
    })
  })
})
