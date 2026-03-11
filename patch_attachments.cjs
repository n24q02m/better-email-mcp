const fs = require('node:fs')
let content = fs.readFileSync('src/tools/composite/attachments.ts', 'utf8')

content = content.replace(
  "import { EmailMCPError, withErrorHandling } from '../helpers/errors.js'",
  "import { EmailMCPError, createUnknownActionError, withErrorHandling } from '../helpers/errors.js'"
)

content = content.replace(
  /throw new EmailMCPError\(\s*`Unknown action: \$\{input\.action\}`,\s*'VALIDATION_ERROR',\s*'Supported actions: list, download'\s*\)/,
  "throw createUnknownActionError(input.action, 'list, download')"
)

fs.writeFileSync('src/tools/composite/attachments.ts', content)
