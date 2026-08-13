import { existsSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const childProcess = vi.hoisted(() => ({
  spawnSync: vi.fn()
}))
const fileSystem = vi.hoisted(() => ({
  sourceOverride: undefined
}))

vi.mock('node:child_process', () => childProcess)
vi.mock('node:fs', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    readFileSync: (...args) => fileSystem.sourceOverride ?? original.readFileSync(...args)
  }
})

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = dirname(scriptDirectory)
const scriptPath = join(scriptDirectory, 'cf-deploy.js')
const tempConfigPath = join(projectRoot, 'wrangler.deploy.jsonc')
const originalArgv = process.argv
const originalEnvironment = Object.fromEntries(
  ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_KV_NAMESPACE_ID', 'PUBLIC_URL'].map((name) => [
    name,
    process.env[name]
  ])
)

class ProcessExitError extends Error {
  constructor(code) {
    super(`process.exit(${code})`)
    this.code = code
  }
}

function restoreEnvironment() {
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) {
      delete process.env[name]
    } else {
      process.env[name] = value
    }
  }
}

async function runDeployScript(passthrough, childResult) {
  process.argv = ['node', scriptPath, ...passthrough]
  childProcess.spawnSync.mockImplementation(childResult)
  await import('./cf-deploy.js')
}

beforeEach(() => {
  vi.resetModules()
  childProcess.spawnSync.mockReset()
  fileSystem.sourceOverride = undefined
  process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account'
  process.env.CLOUDFLARE_API_TOKEN = 'test-token'
  process.env.PUBLIC_URL = 'https://example.test'
  delete process.env.CLOUDFLARE_KV_NAMESPACE_ID
  rmSync(tempConfigPath, { force: true })
  vi.spyOn(process, 'exit').mockImplementation(() => undefined)
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  fileSystem.sourceOverride = undefined
  rmSync(tempConfigPath, { force: true })
  process.argv = originalArgv
  restoreEnvironment()
  vi.restoreAllMocks()
})

describe('cf-deploy validation', () => {
  it.each([
    {
      name: 'account id',
      variable: 'CLOUDFLARE_ACCOUNT_ID',
      message: 'cf:deploy: CLOUDFLARE_ACCOUNT_ID is required (substituted into the image ref).'
    },
    {
      name: 'API token',
      variable: 'CLOUDFLARE_API_TOKEN',
      message: 'cf:deploy: CLOUDFLARE_API_TOKEN is required for wrangler auth.'
    },
    {
      name: 'public URL',
      variable: 'PUBLIC_URL',
      message: 'cf:deploy: PUBLIC_URL is required (substituted into vars.PUBLIC_URL for relay/OAuth URLs).'
    }
  ])('rejects a missing $name before invoking Wrangler', async ({ variable, message }) => {
    delete process.env[variable]
    process.exit.mockImplementation((code) => {
      throw new ProcessExitError(code)
    })

    await expect(runDeployScript([], () => ({ status: 0 }))).rejects.toMatchObject({ code: 1 })

    expect(console.error).toHaveBeenCalledWith(message)
    expect(childProcess.spawnSync).not.toHaveBeenCalled()
    expect(existsSync(tempConfigPath)).toBe(false)
  })

  it('rejects a missing required config placeholder', async () => {
    fileSystem.sourceOverride = '{"publicUrl":"<YOUR_PUBLIC_URL>"}'
    process.exit.mockImplementation((code) => {
      throw new ProcessExitError(code)
    })

    await expect(runDeployScript([], () => ({ status: 0 }))).rejects.toMatchObject({ code: 1 })

    expect(console.error).toHaveBeenCalledWith(
      'cf:deploy: expected <YOUR_ACCOUNT_ID> in wrangler.jsonc; not found. Aborting.'
    )
    expect(childProcess.spawnSync).not.toHaveBeenCalled()
    expect(existsSync(tempConfigPath)).toBe(false)
  })

  it('allows the optional KV placeholder to be absent', async () => {
    fileSystem.sourceOverride = '{"account":"<YOUR_ACCOUNT_ID>","publicUrl":"<YOUR_PUBLIC_URL>"}'

    await runDeployScript(['--dry-run'], () => ({ status: 0 }))

    expect(childProcess.spawnSync).toHaveBeenCalledOnce()
    expect(process.exit).toHaveBeenCalledWith(0)
    expect(existsSync(tempConfigPath)).toBe(false)
  })
})

describe('cf-deploy argument forwarding', () => {
  it.each([
    {
      name: 'direct Wrangler arguments',
      input: ['--dry-run'],
      expected: ['--dry-run']
    },
    {
      name: 'one Bun/npm separator',
      input: ['--', '--dry-run'],
      expected: ['--dry-run']
    },
    {
      name: 'repeated Bun/npm separators',
      input: ['--', '--', '--dry-run'],
      expected: ['--dry-run']
    },
    {
      name: 'an interior Wrangler separator',
      input: ['--dry-run', '--', 'artifact'],
      expected: ['--dry-run', '--', 'artifact']
    }
  ])('normalizes $name without changing Wrangler arguments', async ({ input, expected }) => {
    await runDeployScript(input, () => ({ status: 0 }))

    expect(childProcess.spawnSync).toHaveBeenCalledOnce()
    const [command, args, options] = childProcess.spawnSync.mock.calls[0]
    expect(command).toBe(process.execPath)
    expect(args[0].replaceAll('\\', '/')).toMatch(/node_modules\/wrangler\/bin\/wrangler\.js$/)
    expect(args.slice(1, 4)).toEqual(['deploy', '-c', tempConfigPath])
    expect(args.slice(4)).toEqual(expected)
    expect(options).not.toHaveProperty('shell', true)
  })
})

describe('cf-deploy temporary config cleanup', () => {
  it.each([
    { name: 'success', status: 0, expectedExit: 0 },
    { name: 'Wrangler failure', status: 17, expectedExit: 17 },
    { name: 'missing child status', status: null, expectedExit: 1 }
  ])('removes the file after $name', async ({ status, expectedExit }) => {
    await runDeployScript(['--dry-run'], () => ({ status }))

    expect(existsSync(tempConfigPath)).toBe(false)
    expect(process.exit).toHaveBeenCalledWith(expectedExit)
  })

  it('removes the file when launching Wrangler throws', async () => {
    const launchError = new Error('launcher failed')

    await expect(
      runDeployScript(['--dry-run'], () => {
        throw launchError
      })
    ).rejects.toThrow(launchError)

    expect(existsSync(tempConfigPath)).toBe(false)
    expect(process.exit).not.toHaveBeenCalled()
  })
})
