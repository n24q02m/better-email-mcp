/**
 * Tool Registry - 5 Composite Tools
 * Consolidated registration for maximum coverage with minimal tools
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
import { type AttachmentsInput, attachments } from './composite/attachments.js'
import { type FoldersInput, folders } from './composite/folders.js'
import { type MessagesInput, messages } from './composite/messages.js'
import { type SendInput, send } from './composite/send.js'
// Import mega tools
import type { AccountConfig } from './helpers/config.js'
import { aiReadableMessage, EmailMCPError, enhanceError } from './helpers/errors.js'
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
  { uri: 'email://docs/help', name: 'Help Tool Docs', file: 'help.md' }
]

/**
 * 5 Tools covering full email operations
 * Compressed descriptions for token optimization
 */
const TOOLS = [
  {
    name: 'messages',
    description:
      'Email messages: search, read, mark_read, mark_unread, flag, unflag, move, archive, trash. Search across all accounts or filter by account. Query examples: "UNREAD", "FLAGGED", "SINCE 2026-01-01", "FROM user@example.com", "SUBJECT meeting", "UNREAD SINCE 2026-01-01", "UNREAD FROM boss@company.com". Date format MUST be YYYY-MM-DD.',
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
      'Email attachments: list, download. List shows all attachments with filename, content_type, and size. Download returns base64-encoded content. Most email providers limit attachments to 25MB. Common types: PDF, DOCX, XLSX, images (PNG/JPEG), ZIP. Use list first to get exact filenames before download.',
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
      'Send emails: new, reply, forward. Reply maintains thread headers (In-Reply-To, References) and auto-prepends "Re:" to subject. Forward includes original body and auto-prepends "Fwd:" to subject. Body is sent as plain text by default. For rich formatting (tables, links, bold/italic), use HTML in body with tags like <b>, <a href>, <table>. Plain text is best for simple messages.',
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
          enum: ['messages', 'folders', 'attachments', 'send', 'help'],
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
      'Valid: messages, folders, attachments, send, help'
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
  help: (_, args) => handleHelp(args)
}

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
      const handler = TOOL_HANDLERS[name]
      if (!handler) {
        throw new EmailMCPError(
          `Unknown tool: ${name}`,
          'UNKNOWN_TOOL',
          `Available tools: ${TOOLS.map((t) => t.name).join(', ')}`
        )
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
