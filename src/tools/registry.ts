/**
 * Tool Registry - 6 Composite Tools
 * Consolidated registration for maximum coverage with minimal tools
 *
 * Credential-aware: when state is 'awaiting_setup', tools return setup
 * instructions with the relay URL instead of failing with cryptic errors.
 * The relay session is triggered lazily on first tool call.
 */

import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import { buildOpenRelayHandler } from '@n24q02m/mcp-core'
import { getSetupUrl, getState, triggerRelaySetup } from '../credential-state.js'
import { RELAY_SCHEMA } from '../relay-schema.js'
import { type AttachmentsInput, attachments } from './composite/attachments.js'
import { type ConfigInput, handleConfig } from './composite/config.js'
import { type FoldersInput, folders } from './composite/folders.js'
import { type MessagesInput, messages } from './composite/messages.js'
import { type SendInput, send } from './composite/send.js'
// Import mega tools
import { type AccountConfig, loadConfig } from './helpers/config.js'
import { aiReadableMessage, EmailMCPError, enhanceError, findClosestMatch } from './helpers/errors.js'
import { isValidToolName, wrapToolResult } from './helpers/security.js'

// Get docs directory path - works for both bundled CLI and unbundled code
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// For bundled CLI: __dirname = /bin/, docs at /build/src/docs/
// For unbundled: __dirname = /build/src/tools/, docs at /build/src/docs/
const DOCS_DIR = __dirname.endsWith('bin')
  ? join(__dirname, '..', 'build', 'src', 'docs')
  : join(__dirname, '..', 'docs')

/**
 * Documentation resources for full tool details
 */
const RESOURCES = [
  { uri: 'email://docs/messages', name: 'Messages Tool Docs', file: 'messages.md' },
  { uri: 'email://docs/folders', name: 'Folders Tool Docs', file: 'folders.md' },
  { uri: 'email://docs/attachments', name: 'Attachments Tool Docs', file: 'attachments.md' },
  { uri: 'email://docs/send', name: 'Send Tool Docs', file: 'send.md' },
  { uri: 'email://docs/help', name: 'Help Tool Docs', file: 'help.md' },
  { uri: 'email://docs/config', name: 'Config Tool Docs', file: 'config.md' }
]

/**
 * 6 Tools covering full email operations
 * Compressed descriptions for token optimization
 */
const TOOLS = [
  {
    name: 'messages',
    description:
      'Search, read, and manage email messages.\n\nActions (required params -> optional):\n- search (-> account, query="UNSEEN", folder="INBOX", limit=20)\n- read (account, uid -> folder)\n- mark_read / mark_unread / flag / unflag (account, uid|uids -> folder)\n- move (account, uid|uids, destination -> folder)\n- archive / trash (account, uid|uids -> folder)\n\nQuery examples: "UNREAD", "FROM user@example.com", "SINCE 2026-01-01", "UNREAD FROM boss@company.com". Date format MUST be YYYY-MM-DD.',
    annotations: {
      title: 'Messages',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false
    },
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['search', 'read', 'mark_read', 'mark_unread', 'flag', 'unflag', 'move', 'archive', 'trash'],
          description: 'Action to perform'
        },
        account: { type: 'string', description: 'Account email filter (optional, defaults to all for search)' },
        query: {
          type: 'string',
          description:
            'IMAP search query (default: UNSEEN). Single: UNREAD, FLAGGED, SINCE YYYY-MM-DD, FROM email@example.com, SUBJECT text. Combined: UNREAD SINCE 2026-01-01, UNREAD FROM user@example.com. Dates MUST use YYYY-MM-DD format (e.g. 2026-03-21). Plain text is treated as subject search.'
        },
        folder: { type: 'string', description: 'Mailbox folder (default: INBOX)' },
        limit: { type: 'number', description: 'Max results for search (default: 20)' },
        uid: { type: 'number', description: 'Email UID (for read/modify single email)' },
        uids: { type: 'array', items: { type: 'number' }, description: 'Multiple UIDs for batch operations' },
        destination: { type: 'string', description: 'Target folder for move action' }
      },
      required: ['action']
    }
  },
  {
    name: 'folders',
    description:
      'List mailbox folders.\n\nActions (required params -> optional):\n- list (-> account): folder names, paths, and flags for one or all accounts',
    annotations: {
      title: 'Folders',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    },
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list'],
          description: 'Action to perform'
        },
        account: { type: 'string', description: 'Account email filter (optional, defaults to all)' }
      },
      required: ['action']
    }
  },
  {
    name: 'attachments',
    description:
      'List and download email attachments.\n\nActions (required params -> optional):\n- list (account, uid -> folder): show attachments with filename, content_type, size\n- download (account, uid, filename -> folder): get base64-encoded content\n\nUse list first to get exact filenames. Case-sensitive. Max 25MB per provider.',
    annotations: {
      title: 'Attachments',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    },
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'download'],
          description: 'Action to perform'
        },
        account: { type: 'string', description: 'Account email (required)' },
        uid: { type: 'number', description: 'Email UID (required)' },
        folder: { type: 'string', description: 'Mailbox folder (default: INBOX)' },
        filename: {
          type: 'string',
          description: 'Exact attachment filename from list action (required for download). Case-sensitive.'
        }
      },
      required: ['action', 'account', 'uid']
    }
  },
  {
    name: 'send',
    description:
      'Compose and send emails.\n\nActions (required params -> optional):\n- new (account, to, subject, body -> cc, bcc)\n- reply (account, uid, body -> to, folder): auto-derives recipient, prepends "Re:"\n- forward (account, uid, to, body -> folder): includes original, prepends "Fwd:"\n\nBody: plain text (default) or HTML (<b>, <a href>, <table>). Do NOT mix.',
    annotations: {
      title: 'Send',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    },
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['new', 'reply', 'forward'],
          description: 'Action to perform'
        },
        account: { type: 'string', description: 'Sender account email (required)' },
        to: {
          type: 'string',
          description:
            'Recipient email address (required for new/forward, optional for reply - auto-derived from original sender)'
        },
        subject: { type: 'string', description: 'Email subject (required for new)' },
        body: {
          type: 'string',
          description:
            'Email body (required). Use plain text for simple messages. Use HTML tags (<b>, <i>, <a href="...">, <br>, <table>) for rich formatting. Do NOT mix: send either plain text or HTML, not both.'
        },
        cc: { type: 'string', description: 'CC recipients (comma-separated)' },
        bcc: { type: 'string', description: 'BCC recipients (comma-separated)' },
        uid: { type: 'number', description: 'Original email UID (required for reply/forward)' },
        folder: { type: 'string', description: 'Folder of original email (default: INBOX)' }
      },
      required: ['action', 'account', 'body']
    }
  },
  {
    name: 'config',
    description:
      'Manage email credential setup and runtime configuration.\n\nSetup actions (credential lifecycle):\n- status: Show current credential state, setup URL, and configured accounts\n- setup_start (-> force): Trigger relay setup session and return the setup URL. Set force=true to restart even if already in progress\n- setup_reset: Clear all saved credentials and reset to awaiting_setup state\n- setup_complete: Re-check credential state after external config changes (e.g. relay submission)\n\nRuntime actions:\n- set: Update runtime settings (email has no runtime settings; returns ok=false)\n- cache_clear: Clear in-memory account and OAuth token caches',
    annotations: {
      title: 'Config',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    },
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['status', 'setup_start', 'setup_reset', 'setup_complete', 'set', 'cache_clear'],
          description: 'Action to perform'
        },
        force: {
          type: 'boolean',
          description: 'Force restart relay setup even if already in progress (for setup_start action)'
        }
      },
      required: ['action']
    }
  },
  {
    name: 'config__open_relay',
    description:
      'Open the relay configuration form for better-email-mcp in the user browser. Returns the relay URL, whether the browser launched, and the current credential state. Auto-respawns the daemon if it has died.',
    annotations: {
      title: 'Open Relay',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    },
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'help',
    description: 'Get full documentation for a tool. Use when compressed descriptions are insufficient.',
    annotations: {
      title: 'Help',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    },
    inputSchema: {
      type: 'object',
      properties: {
        tool_name: {
          type: 'string',
          enum: ['messages', 'folders', 'attachments', 'send', 'config', 'help'],
          description: 'Tool to get documentation for'
        }
      },
      required: ['tool_name']
    }
  }
]

/**
 * Register all tools with MCP server
 */

async function handleHelp(args: unknown): Promise<{ tool: string; documentation: string }> {
  const toolName = (args as { tool_name: string }).tool_name
  if (!isValidToolName(toolName)) {
    throw new EmailMCPError(
      `Invalid tool name: ${toolName}`,
      'VALIDATION_ERROR',
      'Valid: messages, folders, attachments, send, config, help'
    )
  }
  const resource = RESOURCES.find((r) => r.uri === `email://docs/${toolName}`)
  if (!resource) {
    throw new EmailMCPError(`Documentation not found for: ${toolName}`, 'DOC_NOT_FOUND', 'Check tool_name')
  }
  try {
    const content = await readFile(join(DOCS_DIR, resource.file), 'utf-8')
    return { tool: toolName, documentation: content }
  } catch {
    throw new EmailMCPError(`Documentation not found for: ${toolName}`, 'DOC_NOT_FOUND', 'Check tool_name')
  }
}

type ToolHandler = (accounts: AccountConfig[], args: unknown) => Promise<unknown>

const TOOL_HANDLERS: Record<string, ToolHandler> = {
  messages: (accounts, args) => messages(accounts, args as unknown as MessagesInput),
  folders: (accounts, args) => folders(accounts, args as unknown as FoldersInput),
  attachments: (accounts, args) => attachments(accounts, args as unknown as AttachmentsInput),
  send: (accounts, args) => send(accounts, args as unknown as SendInput),
  config: (accounts, args) => handleConfig(accounts, args as unknown as ConfigInput),
  help: (_, args) => handleHelp(args)
}

// Pre-compute derived values to avoid redundant allocations on every request
const FORMATTED_RESOURCES = RESOURCES.map((r) => ({
  uri: r.uri,
  name: r.name,
  mimeType: 'text/markdown'
}))
const AVAILABLE_RESOURCE_URIS_STRING = RESOURCES.map((r) => r.uri).join(', ')
const VALID_TOOL_NAMES = TOOLS.map((t) => t.name)
const AVAILABLE_TOOLS_STRING = VALID_TOOL_NAMES.join(', ')

export function registerTools(server: Server, initialAccounts: AccountConfig[]) {
  // Mutable reference: updated via hot-reload when relay credentials arrive after startup
  let accounts = initialAccounts
  const openRelayHandler = buildOpenRelayHandler('better-email-mcp', RELAY_SCHEMA)
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS
  }))

  // Resources handlers for full documentation
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: FORMATTED_RESOURCES
  }))

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params
    const resource = RESOURCES.find((r) => r.uri === uri)

    if (!resource) {
      throw new EmailMCPError(
        `Resource not found: ${uri}`,
        'RESOURCE_NOT_FOUND',
        `Available: ${AVAILABLE_RESOURCE_URIS_STRING}`
      )
    }

    const content = await readFile(join(DOCS_DIR, resource.file), 'utf-8')
    return {
      contents: [{ uri, mimeType: 'text/markdown', text: content }]
    }
  })

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    if (!args) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: No arguments provided'
          }
        ],
        isError: true
      }
    }

    try {
      // config__open_relay is handled directly via buildOpenRelayHandler — it does
      // not depend on configured accounts, takes no args, and returns its own JSON
      // shape (url, browserOpened, status, etc.).
      if (name === 'config__open_relay') {
        const result = await openRelayHandler()
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        }
      }

      const handler = TOOL_HANDLERS[name]
      if (!handler) {
        const closest = findClosestMatch(name, VALID_TOOL_NAMES)
        const suggestion = closest ? ` Did you mean '${closest}'?` : ''
        throw new EmailMCPError(
          `Unknown tool: ${name}.${suggestion}`,
          'UNKNOWN_TOOL',
          `Available tools: ${AVAILABLE_TOOLS_STRING}`
        )
      }

      // Credential guard: when not configured, return setup instructions.
      // Help, config, and config__open_relay tools are always available (docs don't
      // need credentials; config and config__open_relay manage the credential
      // lifecycle itself).
      // The relay session is triggered lazily on first non-exempt tool call.
      if (name !== 'help' && name !== 'config' && name !== 'config__open_relay' && accounts.length === 0) {
        const credState = getState()
        if (credState === 'configured') {
          // Hot-reload: relay delivered credentials after startup — reload accounts
          accounts = await loadConfig()
        } else {
          // Trigger relay setup if not already in progress
          if (credState === 'awaiting_setup') {
            await triggerRelaySetup()
          }
          const url = getSetupUrl()
          const setupInstructions = url
            ? `Email credentials are not configured yet.\n\nTo set up, open this URL in your browser:\n${url}\n\nAfter submitting credentials on the relay page, retry this tool call.`
            : `Email credentials are not configured.\n\nSet the EMAIL_CREDENTIALS environment variable.\nFormat: email1:password1,email2:password2\n\nOr restart the server to trigger the relay setup page.`
          return {
            content: [{ type: 'text', text: setupInstructions }],
            isError: true
          }
        }
      }

      const result = await handler(accounts, args)

      const jsonText = JSON.stringify(result, null, 2)
      return {
        content: [
          {
            type: 'text',
            text: wrapToolResult(name, jsonText)
          }
        ]
      }
    } catch (error) {
      const enhancedError = error instanceof EmailMCPError ? error : enhanceError(error)

      return {
        content: [
          {
            type: 'text',
            text: aiReadableMessage(enhancedError)
          }
        ],
        isError: true
      }
    }
  })
}
