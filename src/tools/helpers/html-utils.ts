/**
 * HTML to Clean Text Utilities
 * Strips HTML tags, CSS, scripts and returns clean text for LLM consumption
 */

import { convert } from 'html-to-text'

const ENTITY_MAP: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#039;': "'",
  '&#x27;': "'"
}

/**
 * Escapes HTML characters in a string to prevent XSS attacks when embedding user input into HTML
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// ⚡ Bolt: Extract html-to-text options into a module-scoped constant.
// This prevents reallocation and deep object parsing overhead on every call.
const HTML_TO_TEXT_OPTIONS = {
  wordwrap: false,
  preserveNewlines: true,
  selectors: [
    // Remove style and script tags entirely
    { selector: 'style', format: 'skip' },
    { selector: 'script', format: 'skip' },
    // Remove images (just show alt text if any)
    { selector: 'img', format: 'skip' },
    // Keep links as text
    { selector: 'a', options: { hideLinkHrefIfSameAsText: true, ignoreHref: false } },
    // Tables as readable text
    { selector: 'table', format: 'dataTable' }
  ]
} as const

/**
 * Convert HTML email body to clean plain text
 * Removes CSS, scripts, images, and formatting noise to save LLM tokens
 */
export function htmlToCleanText(html: string): string {
  if (!html) return ''

  return convert(html, HTML_TO_TEXT_OPTIONS as any).trim()
}

/**
 * Fast regex-based HTML snippet extraction for search results
 * Much faster than full html-to-text for short previews (~30x speedup)
 */
export function fastExtractSnippet(html: string, maxLength = 200): string {
  if (!html) return ''

  // ⚡ Bolt: Iteratively remove style/script blocks using a combined regex with a backreference.
  // This reduces string parsing overhead compared to running separate passes for style and script tags.
  let text = html
  let prev: string
  do {
    prev = text
    text = text.replace(/<(style|script)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, '')
  } while (text !== prev)

  // Replace block elements with spaces
  text = text.replace(/<\/(p|div|br|tr|li|h[1-6])>/gi, ' ')
  text = text.replace(/<br\s*\/?>/gi, ' ')

  // Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '')

  // ⚡ Bolt: Decode HTML entities in a single pass.
  // We use the capture group `p1` (which contains the entity name or number without the `&` and `;`)
  // to avoid invoking `entity.match(...)` internally, which creates secondary string allocations.
  text = text.replace(/&(#x?[\da-fA-F]+|[a-zA-Z]+);/g, (entity, p1) => {
    const lower = entity.toLowerCase()
    if (lower in ENTITY_MAP) return ENTITY_MAP[lower]

    // Check if it's a numeric entity starting with '#'
    if (p1[0] === '#') {
      const isHex = p1[1] === 'x' || p1[1] === 'X'
      // Parse using radix 16 or 10 depending on whether it has an 'x'
      const code = isHex ? Number.parseInt(p1.substring(2), 16) : Number.parseInt(p1.substring(1), 10)
      if (!Number.isNaN(code)) return String.fromCharCode(code)
    }
    return entity
  })

  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim()

  if (text.length <= maxLength) return text
  return `${text.substring(0, maxLength)}...`
}
