/**
 * HTML to Clean Text Utilities
 * Strips HTML tags, CSS, scripts and returns clean text for LLM consumption
 */

import { compile } from 'html-to-text'
import sanitize from 'sanitize-html'

const ENTITY_MAP: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#039;': "'",
  '&#x27;': "'"
}

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;'
}

// ⚡ Bolt: Pre-compile regular expressions to avoid repeated parsing and
// allocation overhead on every function call.
const HTML_ESCAPE_REGEX = /[&<>"']/g
const FAST_EXTRACT_STYLE_SCRIPT_TEST_REGEX = /<(?:style|script)/i
const FAST_EXTRACT_STYLE_SCRIPT_REPLACE_REGEX = /<(style|script)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi
const FAST_EXTRACT_BLOCK_REGEX = /<\/(p|div|br|tr|li|h[1-6])>/gi
const FAST_EXTRACT_BR_REGEX = /<br\s*\/?>/gi
const FAST_EXTRACT_TAG_REGEX = /<[^>]*>?/g
const FAST_EXTRACT_ENTITY_REGEX = /&(#x?[\da-fA-F]+|[a-zA-Z]+);/g
const FAST_EXTRACT_WHITESPACE_REGEX = /\s+/g

/**
 * Escapes HTML characters in a string to prevent XSS attacks when embedding user input into HTML
 */
export function escapeHtml(unsafe: string): string {
  // ⚡ Bolt: Replace 5 chained `.replace()` calls with a single regex pass.
  // This reduces string allocation overhead and speeds up escaping by iterating over the string only once.
  return unsafe.replace(HTML_ESCAPE_REGEX, (match) => HTML_ESCAPE_MAP[match]!)
}

// ⚡ Bolt: Extract `html-to-text` options into a module-scoped constant.
// This prevents recreating the configuration object and its nested arrays on every call,
// significantly reducing allocation overhead and improving conversion speed in high-frequency functions.
const HTML_TO_TEXT_OPTIONS: import('html-to-text').HtmlToTextOptions = {
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
}

const compiledHtmlToText = compile(HTML_TO_TEXT_OPTIONS)

/**
 * Convert HTML email body to clean plain text
 * Removes CSS, scripts, images, and formatting noise to save LLM tokens
 */
export function htmlToCleanText(html: string): string {
  if (!html) return ''

  return compiledHtmlToText(html).trim()
}

/**
 * Fast regex-based HTML snippet extraction for search results
 * Much faster than full html-to-text for short previews (~30x speedup)
 */
export function fastExtractSnippet(html: string, maxLength = 200): string {
  if (!html) return ''

  // ⚡ Bolt: Fast path for plain text.
  // Bypasses complex regex operations entirely if the input string contains no HTML tags or entities.
  if (html.indexOf('<') === -1 && html.indexOf('&') === -1) {
    const cleaned = html.replace(FAST_EXTRACT_WHITESPACE_REGEX, ' ').trim()
    if (cleaned.length <= maxLength) return cleaned
    return `${cleaned.substring(0, maxLength)}...`
  }

  // ⚡ Bolt: Iteratively remove style/script blocks using a combined regex with a backreference.
  // This reduces string parsing overhead compared to running separate passes for style and script tags.
  let text = html

  if (FAST_EXTRACT_STYLE_SCRIPT_TEST_REGEX.test(text)) {
    let prev: string
    do {
      prev = text
      text = text.replace(FAST_EXTRACT_STYLE_SCRIPT_REPLACE_REGEX, '')
    } while (text !== prev)
  }

  // Replace block elements with spaces
  text = text.replace(FAST_EXTRACT_BLOCK_REGEX, ' ')
  text = text.replace(FAST_EXTRACT_BR_REGEX, ' ')

  // Strip all remaining HTML tags
  text = text.replace(FAST_EXTRACT_TAG_REGEX, '')

  // ⚡ Bolt: Decode HTML entities in a single pass.
  // We use the capture group `p1` (which contains the entity name or number without the `&` and `;`)
  // to avoid invoking `entity.match(...)` internally, which creates secondary string allocations.
  if (text.indexOf('&') !== -1) {
    text = text.replace(FAST_EXTRACT_ENTITY_REGEX, (entity, p1) => {
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
  }

  // Collapse whitespace
  text = text.replace(FAST_EXTRACT_WHITESPACE_REGEX, ' ').trim()

  if (text.length <= maxLength) return text
  return `${text.substring(0, maxLength)}...`
}

/**
 * Centralized HTML sanitization options for emails
 */
export const EMAIL_SANITIZE_OPTIONS: sanitize.IOptions = {
  allowedTags: sanitize.defaults.allowedTags.concat(['img'])
}

/**
 * Sanitize HTML content using centralized options
 */
export function sanitizeHtml(html: string, options: sanitize.IOptions = EMAIL_SANITIZE_OPTIONS): string {
  return sanitize(html, options)
}
