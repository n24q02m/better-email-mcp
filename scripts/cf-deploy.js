// scripts/cf-deploy.js - deploy the better-email-mcp Worker + Container to Cloudflare.
//
// wrangler.jsonc keeps live resource IDs as placeholders so they are never
// committed (see the file header). This script fills them at deploy time into a
// temp config (wrangler.deploy.jsonc, gitignored) and runs `wrangler deploy`:
//   <YOUR_ACCOUNT_ID>              -> $CLOUDFLARE_ACCOUNT_ID (container image ref)
//   <better-email-kv-namespace-id> -> $CLOUDFLARE_KV_NAMESPACE_ID (KV binding)
//
// Required env:
//   CLOUDFLARE_ACCOUNT_ID       - target account id (also substituted into image ref).
//   CLOUDFLARE_API_TOKEN        - full-access (or Workers+Containers) token for auth.
//   CLOUDFLARE_KV_NAMESPACE_ID  - live KV namespace id for the KV binding.
//                                 Look it up once with `wrangler kv namespace list`
//                                 (or reuse the existing binding on the live worker).
//
// This is config-only: it reuses the already-pushed :beta image and preserves
// existing `wrangler secret put` secrets. It rolls the Worker bundle (sleepAfter)
// and the container application config (instance_type / max_instances).
//
// Usage:
//   CLOUDFLARE_ACCOUNT_ID=<id> CLOUDFLARE_KV_NAMESPACE_ID=<kv> \
//     CLOUDFLARE_API_TOKEN=<token> bun run cf:deploy
//   bun run cf:deploy -- --dry-run        # validate without deploying

import { spawnSync } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
if (!accountId) {
  console.error('cf:deploy: CLOUDFLARE_ACCOUNT_ID is required (substituted into the image ref).')
  process.exit(1)
}
if (!process.env.CLOUDFLARE_API_TOKEN) {
  console.error('cf:deploy: CLOUDFLARE_API_TOKEN is required for wrangler auth.')
  process.exit(1)
}

// Placeholder -> live value. KV id is optional only for --dry-run (upload-only).
const substitutions = [
  { placeholder: '<YOUR_ACCOUNT_ID>', value: accountId, required: true },
  { placeholder: '<better-email-kv-namespace-id>', value: process.env.CLOUDFLARE_KV_NAMESPACE_ID, required: false }
]

const source = join(projectRoot, 'wrangler.jsonc')
let resolved = readFileSync(source, 'utf8')
for (const { placeholder, value, required } of substitutions) {
  if (!resolved.includes(placeholder)) {
    if (required) {
      console.error(`cf:deploy: expected ${placeholder} in wrangler.jsonc; not found. Aborting.`)
      process.exit(1)
    }
    continue
  }
  if (!value) {
    console.warn(`cf:deploy: ${placeholder} left unfilled (set the matching env var for a real deploy).`)
    continue
  }
  resolved = resolved.split(placeholder).join(value)
  console.log(`cf:deploy: substituted ${placeholder}`)
}

// Write the temp config INSIDE projectRoot: wrangler resolves `main` and other
// paths relative to the config file's directory, so it must sit next to src/.
const tempConfig = join(projectRoot, 'wrangler.deploy.jsonc')
writeFileSync(tempConfig, resolved)

const passthrough = process.argv.slice(2)
const args = ['wrangler', 'deploy', '-c', tempConfig, ...passthrough]
console.log(`cf:deploy: running npx ${args.join(' ')}`)

const result = spawnSync('npx', args, { cwd: projectRoot, stdio: 'inherit', shell: process.platform === 'win32' })
rmSync(tempConfig, { force: true })
process.exit(result.status ?? 1)
