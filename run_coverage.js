import { execSync } from 'node:child_process'

try {
  const result = execSync(
    'npx vitest run --coverage src/tools/registry.logic.test.ts src/tools/registry.integration.test.ts src/tools/registry.test.ts',
    { encoding: 'utf-8' }
  )
  console.log(result)
} catch (error) {
  console.error(error.stdout)
}
