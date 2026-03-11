const fs = require('node:fs')
let content = fs.readFileSync('src/tools/composite/messages.ts', 'utf8')

content = content.replace(
  "import { EmailMCPError, withErrorHandling } from '../helpers/errors.js'",
  "import { EmailMCPError, createUnknownActionError, withErrorHandling } from '../helpers/errors.js'"
)

content = content.replace(
  /throw new EmailMCPError\(\s*`Unknown action: \$\{input\.action\}`,\s*'VALIDATION_ERROR',\s*'Supported actions: search, read, mark_read, mark_unread, flag, unflag, move, archive, trash'\s*\)/,
  "throw createUnknownActionError(input.action, 'search, read, mark_read, mark_unread, flag, unflag, move, archive, trash')"
)

fs.writeFileSync('src/tools/composite/messages.ts', content)
