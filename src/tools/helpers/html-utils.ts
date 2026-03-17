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

/**
 * Convert HTML email body to clean plain text
 * Removes CSS, scripts, images, and formatting noise to save LLM tokens
 */
export function htmlToCleanText(html: string): string {
  if (!html) return ''

  return convert(html, {
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
  }).trim()
}

/**
 * Fast regex-based HTML snippet extraction for search results
 * Much faster than full html-to-text for short previews (~30x speedup)
 */
export function fastExtractSnippet(html: string, maxLength = 200): string {
  if (!html) return ''

  // Iteratively remove style/script blocks (handles nested tags)
  let text = html
  let prev: string
  do {
    prev = text
    text = text.replace(/<style\b[^>]*>[\s\S]*?(?:<\/style\s*>|$)/gi, '')
    text = text.replace(/<script\b[^>]*>[\s\S]*?(?:<\/script\s*>|$)/gi, '')
  } while (text !== prev)

  // Replace block elements with spaces
  text = text.replace(/<\/(p|div|br|tr|li|h[1-6])>/gi, ' ')
  text = text.replace(/<br\s*\/?>/gi, ' ')

  // Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '')

  // Decode HTML entities in a single pass to avoid double-decode
  // (e.g., &amp;lt; should become &lt; not <)
  text = text.replace(/&(#x?[\da-fA-F]+|[a-zA-Z]+);/g, (entity) => {
    const lower = entity.toLowerCase()
    if (lower in ENTITY_MAP) return ENTITY_MAP[lower]
    const numMatch = entity.match(/&#x?([\da-fA-F]+);/)
    if (numMatch) {
      const code = entity.startsWith('&#x') ? Number.parseInt(numMatch[1], 16) : Number.parseInt(numMatch[1], 10)
      return String.fromCharCode(code)
    }
    return entity
  })

  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim()

  if (text.length <= maxLength) return text
  return `${text.substring(0, maxLength)}...`
}
