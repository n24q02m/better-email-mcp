/**
 * CLI for OAuth2 authentication (Device Code flow) + local session logout.
 *
 * Usage:
 *   npx @n24q02m/better-email-mcp auth [outlook] user@outlook.com [--client-id=<id>]
 *   npx @n24q02m/better-email-mcp logout [user@outlook.com]
 *
 * The leading `outlook` provider positional is optional (email has a single
 * OAuth2 provider today) -- kept for CLI naming parity with wet/mnemo's
 * `auth <provider>` and telegram's `auth [<provider>]`, per the WS5 CLI/auth
 * naming standard. `--client-id` is single-user / local-machine only, same
 * scope as the rest of this CLI (per tool-layout.md CLI Surface invariants).
 */

import { deleteStoredTokens, deviceCodeAuth, isOutlookDomain } from './tools/helpers/oauth2.js'

const KNOWN_PROVIDERS = new Set(['outlook'])

interface ParsedArgs {
  positionals: string[]
  clientId: string | null
}

/** Split CLI args into positionals and the `--client-id[=value]` flag. */
function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = []
  let clientId: string | null = null
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string
    if (arg.startsWith('--client-id=')) {
      clientId = arg.slice('--client-id='.length)
    } else if (arg === '--client-id') {
      i += 1
      clientId = argv[i] ?? null
    } else {
      positionals.push(arg)
    }
  }
  return { positionals, clientId }
}

/** Drop a leading known-provider positional (e.g. `outlook`), if present. */
function stripProvider(positionals: string[]): string[] {
  const [first, ...rest] = positionals
  return first && KNOWN_PROVIDERS.has(first.toLowerCase()) ? rest : positionals
}

export async function runAuth(): Promise<void> {
  const { positionals, clientId } = parseArgs(process.argv.slice(3))
  const email = stripProvider(positionals)[0]?.trim()

  if (!email) {
    console.error('Usage: better-email-mcp auth [outlook] <email> [--client-id=<id>]')
    console.error('Example: better-email-mcp auth user@outlook.com')
    console.error('')
    console.error('Authenticates an Outlook/Hotmail/Live account via OAuth2 Device Code flow.')
    console.error('Tokens are saved to ~/.better-email-mcp/tokens.json')
    process.exit(1)
  }

  if (!isOutlookDomain(email)) {
    console.error(`OAuth2 auth is only needed for Outlook/Hotmail/Live accounts.`)
    console.error(`For ${email}, use an App Password in EMAIL_CREDENTIALS instead.`)
    process.exit(1)
  }

  try {
    if (clientId) {
      await deviceCodeAuth(email, clientId)
    } else {
      await deviceCodeAuth(email)
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`\nError: ${message}`)
    process.exit(1)
  }
}

export async function runLogout(): Promise<void> {
  const { positionals } = parseArgs(process.argv.slice(3))
  const email = stripProvider(positionals)[0]?.trim()

  const deleted = await deleteStoredTokens(email || undefined)
  if (deleted.length === 0) {
    console.error(
      email ? `Nothing to log out (no saved token for ${email}).` : 'Nothing to log out (no saved Outlook tokens).'
    )
    return
  }
  console.error(`Logged out. Cleared token(s) for: ${deleted.join(', ')}`)
}
