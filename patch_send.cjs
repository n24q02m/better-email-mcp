const fs = require('node:fs')
let content = fs.readFileSync('src/tools/composite/send.ts', 'utf8')

content = content.replace(
  "import { EmailMCPError, withErrorHandling } from '../helpers/errors.js'",
  "import { EmailMCPError, createUnknownActionError, withErrorHandling } from '../helpers/errors.js'"
)

content = content.replace(
  /throw new EmailMCPError\(\s*`Unknown action: \$\{input\.action\}`,\s*'VALIDATION_ERROR',\s*'Supported actions: new, reply, forward'\s*\)/,
  "throw createUnknownActionError(input.action, 'new, reply, forward')"
)

fs.writeFileSync('src/tools/composite/send.ts', content)
