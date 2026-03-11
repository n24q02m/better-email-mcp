const fs = require('node:fs')
const content = fs.readFileSync('src/tools/helpers/errors.ts', 'utf8')

const newFunction = `
/**
 * Create a standard error for unknown actions
 */
export function createUnknownActionError(action: string, supportedActions: string): EmailMCPError {
  return new EmailMCPError(
    \`Unknown action: \${action}\`,
    'VALIDATION_ERROR',
    \`Supported actions: \${supportedActions}\`
  )
}
`

fs.writeFileSync('src/tools/helpers/errors.ts', content + newFunction)
