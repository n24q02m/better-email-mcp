/**
 * Tool Registry - 5 Composite Tools
 * Consolidated registration for maximum coverage with minimal tools
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import { attachments } from './composite/attachments.js'
import { folders } from './composite/folders.js'
import { messages } from './composite/messages.js'
import { send } from './composite/send.js'
// Import mega tools
import type { AccountConfig } from './helpers/config.js'
import { aiReadableMessage, EmailMCPError, enhanceError } from './helpers/errors.js'

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
  { tool: 'messages', uri: 'email://docs/messages', name: 'Messages Tool Docs', file: 'messages.md' },
  { tool: 'folders', uri: 'email://docs/folders', name: 'Folders Tool Docs', file: 'folders.md' },
  { tool: 'attachments', uri: 'email://docs/attachments', name: 'Attachments Tool Docs', file: 'attachments.md' },
  { tool: 'send', uri: 'email://docs/send', name: 'Send Tool Docs', file: 'send.md' }
]

/**
 * 5 Tools covering full email operations
 * Compressed descriptions for token optimization
 */
const TOOLS = [
  {
    name: 'messages',
    description:
      'Email messages: search, read, mark_read, mark_unread, flag, unflag, move, archive, trash. Search across all accounts or filter by account. Query supports: UNREAD, FLAGGED, SINCE YYYY-MM-DD, FROM x, SUBJECT x.',
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
            'Search query: UNREAD, FLAGGED, SINCE YYYY-MM-DD, FROM email, SUBJECT text, or combined (default: UNSEEN)'
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
    description: 'List mailbox folders for one or all email accounts. Returns folder names, paths, and flags.',
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
      'Email attachments: list, download. List shows all attachments for an email. Download returns base64-encoded content.',
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
        filename: { type: 'string', description: 'Attachment filename (required for download)' }
      },
      required: ['action', 'account', 'uid']
    }
  },
  {
    name: 'send',
    description:
      'Send emails: new, reply, forward. Reply maintains thread headers (In-Reply-To, References). Forward includes original body.',
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
        to: { type: 'string', description: 'Recipient email address (required)' },
        subject: { type: 'string', description: 'Email subject (required for new)' },
        body: { type: 'string', description: 'Email body text (required)' },
        cc: { type: 'string', description: 'CC recipients (comma-separated)' },
        bcc: { type: 'string', description: 'BCC recipients (comma-separated)' },
        uid: { type: 'number', description: 'Original email UID (required for reply/forward)' },
        folder: { type: 'string', description: 'Folder of original email (default: INBOX)' }
      },
      required: ['action', 'account', 'to', 'body']
    }
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
          enum: ['messages', 'folders', 'attachments', 'send'],
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
export function registerTools(server: Server, accounts: AccountConfig[]) {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS
  }))

  // Resources handlers for full documentation
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: RESOURCES.map((r) => ({
      uri: r.uri,
      name: r.name,
      mimeType: 'text/markdown'
    }))
  }))

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params
    const resource = RESOURCES.find((r) => r.uri === uri)

    if (!resource) {
      throw new EmailMCPError(
        `Resource not found: ${uri}`,
        'RESOURCE_NOT_FOUND',
        `Available: ${RESOURCES.map((r) => r.uri).join(', ')}`
      )
    }

    const content = readFileSync(join(DOCS_DIR, resource.file), 'utf-8')
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
      let result

      switch (name) {
        case 'messages':
          result = await messages(accounts, args as any)
          break
        case 'folders':
          result = await folders(accounts, args as any)
          break
        case 'attachments':
          result = await attachments(accounts, args as any)
          break
        case 'send':
          result = await send(accounts, args as any)
          break
        case 'help': {
          const toolName = (args as { tool_name: string }).tool_name
          const resource = RESOURCES.find((r) => r.tool === toolName)

          if (!resource) {
            throw new EmailMCPError(`Documentation not found for: ${toolName}`, 'DOC_NOT_FOUND', 'Check tool_name')
          }

          try {
            const content = readFileSync(join(DOCS_DIR, resource.file), 'utf-8')
            result = { tool: toolName, documentation: content }
          } catch {
            throw new EmailMCPError(
              `Documentation file not found: ${resource.file}`,
              'DOC_FILE_NOT_FOUND',
              'Check installation'
            )
          }
          break
        }
        default:
          throw new EmailMCPError(
            `Unknown tool: ${name}`,
            'UNKNOWN_TOOL',
            `Available tools: ${TOOLS.map((t) => t.name).join(', ')}`
          )
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
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
