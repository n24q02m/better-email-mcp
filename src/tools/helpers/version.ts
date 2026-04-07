import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Get the version of the package by reading package.json.
 * Walks up from the current directory to find the package root.
 */
export function getVersion(): string {
  try {
    // Check environment variable first (set by npm/bun run)
    if (process.env.npm_package_version) {
      return process.env.npm_package_version
    }

    let dir = __dirname
    for (let i = 0; i < 5; i++) {
      const pkgPath = join(dir, 'package.json')
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
        // Verify it's our package
        if (pkg.name === '@n24q02m/better-email-mcp') {
          return pkg.version ?? '0.0.0'
        }
      }
      dir = dirname(dir)
    }
    return '0.0.0'
  } catch {
    return '0.0.0'
  }
}
