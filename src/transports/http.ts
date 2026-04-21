/**
 * HTTP Transport -- unified credential form for both local-relay and
 * remote-relay modes per the MCP mode matrix.
 *
 * Both modes render the SAME multi-provider paste form
 * (Gmail/Yahoo/iCloud/custom IMAP + Outlook) via ``relaySchema +
 * renderEmailCredentialForm``. Outlook accounts trigger the Microsoft
 * Device Code flow in-band through the ``oauth_device_code`` NextStep; the
 * rest validate with a real IMAP login. UI and flow are identical between
 * modes -- only the storage scope differs (see below).
 *
 * Modes (selected via ``MCP_MODE`` env var, default ``remote-relay``):
 *   - ``local-relay``  -> single-user. Credentials persist to the encrypted
 *                         config.enc file plus ``process.env.EMAIL_CREDENTIALS``
 *                         so every tool call hits the same mailbox set.
 *   - ``remote-relay`` -> multi-user (target). Per-session credentials keyed
 *                         by the JWT ``sub`` claim issued by the local OAuth
 *                         AS; two browsers opening the same URL never see
 *                         each other's mailbox data.
 *
 * Multi-user storage for ``remote-relay`` currently falls back to the
 * single-user path because the upstream ``runLocalServer(relaySchema)``
 * primitive in mcp-core issues a static ``sub='local-user'`` for all
 * sessions. Follow-up: mcp-core v1.5+ will generate a per-session UUID
 * subject and thread it through to ``onCredentialsSaved``; this module
 * will switch the remote-relay branch to call ``storeUserCredentials(sub,
 * accounts)`` without any UI change.
 *
 * The shared ``runLocalServer`` options (``onCredentialsSaved``,
 * ``customCredentialFormHtml``, ``setupCompleteHook``) live in
 * ``src/spawn-setup.ts`` so the stdio fallback in ``credential-state.ts``
 * presents an identical credential form without duplicating logic.
 *
 * Lifecycle (both modes):
 *  - ``resolveCredentialState()`` loads any existing EMAIL_CREDENTIALS from
 *    env / encrypted config at boot so tools work immediately.
 *  - Missing credentials -> server still starts; tools return setup
 *    instructions pointing to ``/authorize`` until the user submits.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { runLocalServer } from '@n24q02m/mcp-core'

import { resolveCredentialState } from '../credential-state.js'
import { buildRunLocalServerOptions } from '../spawn-setup.js'
import { type AccountConfig, loadConfig } from '../tools/helpers/config.js'
import { registerTools } from '../tools/registry.js'

const SERVER_NAME = 'better-email-mcp'

export type HttpMode = 'remote-relay' | 'local-relay'

export function resolveHttpMode(env: NodeJS.ProcessEnv): HttpMode {
  const raw = env.MCP_MODE?.toLowerCase().trim()
  if (raw === 'local-relay' || raw === 'remote-relay') return raw
  return 'remote-relay'
}

export async function startHttp(): Promise<void> {
  const mode = resolveHttpMode(process.env)

  await resolveCredentialState()

  let currentAccounts: AccountConfig[] = await loadConfig()

  const serverFactory = (): McpServer => {
    const server = new Server(
      { name: `@n24q02m/${SERVER_NAME}`, version: '0.0.0' },
      { capabilities: { tools: {}, resources: {} } }
    )
    registerTools(server, currentAccounts)
    return server as unknown as McpServer
  }

  const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 0
  const host = process.env.HOST

  const handle = await runLocalServer(
    serverFactory,
    buildRunLocalServerOptions({
      serverFactory,
      port,
      host,
      mode,
      onAccountsLoaded: (accounts) => {
        // Refresh closure so subsequent tool calls see the new mailbox set
        // without a restart. Stdio doesn't need this hook -- its tool
        // registry reloads config.enc via loadConfig() on every call.
        currentAccounts = accounts
      }
    })
  )

  console.error(`[${SERVER_NAME}] ${mode} mode on http://${handle.host}:${handle.port}/mcp`)
  if (currentAccounts.length === 0) {
    console.error(
      `[${SERVER_NAME}] Open http://${handle.host}:${handle.port}/authorize to configure your email accounts`
    )
  }

  await new Promise<void>((resolve) => {
    const shutdown = async () => {
      await handle.close()
      resolve()
    }
    process.once('SIGINT', shutdown)
    process.once('SIGTERM', shutdown)
  })
}
