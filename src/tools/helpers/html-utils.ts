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

/**
 * Escapes HTML characters in a string to prevent XSS attacks when embedding user input into HTML
 */
export function escapeHtml(unsafe: unknown): string {
  // ⚡ Bolt: Use V8 fast-path chained replacements for string escaping.
  // In V8 environments (Node.js/Bun), chained `.replace()` calls with regular expressions
  // and string literal replacements perform significantly faster than a single `.replace()`
  // with a mapping callback, as they avoid crossing the C++/JS boundary for every match.
  return String(unsafe ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// ⚡ Bolt: Extract `html-to-text` options into a module-scoped constant.
// This prevents recreating the configuration object and its nested arrays on every call,
// significantly reducing allocation overhead and improving conversion speed in high-frequency functions.
// ⚡ Bolt: Pre-compile regular expressions to prevent recompilation on every invocation.
// In hot paths like text processing, extracting these to module-scoped constants
// reduces memory allocation and garbage collection overhead.
const RE_WHITESPACE = /\s+/g
const RE_STYLE_SCRIPT = /<(style|script)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi
const RE_BLOCK_TAGS = /<\/(p|div|br|tr|li|h[1-6])>/gi
const RE_BR_TAGS = /<br\s*\/?>/gi
const RE_ANY_TAG = /<[^>]+>/g
const RE_ENTITIES = /&(#(?:x|X)?[\da-fA-F]+|[a-zA-Z]+);/g

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
    const cleaned = html.replace(RE_WHITESPACE, ' ').trim()
    if (cleaned.length <= maxLength) return cleaned
    return `${cleaned.substring(0, maxLength)}...`
  }

  // ⚡ Bolt: Iteratively remove style/script blocks using a combined regex with a backreference.
  // This reduces string parsing overhead compared to running separate passes for style and script tags.
  // We also avoid `if (pattern.test(text))` because V8's `.replace()` fast-path already performs
  // an O(N) scan without reallocation if the pattern is missing, making `.test()` a redundant check.
  let text = html
  let prev: string
  do {
    prev = text
    text = text.replace(RE_STYLE_SCRIPT, '')
  } while (text !== prev)

  // Replace block elements with spaces
  text = text.replace(RE_BLOCK_TAGS, ' ')
  text = text.replace(RE_BR_TAGS, ' ')

  // Strip all remaining HTML tags
  // ⚡ Bolt: Iteratively strip tags to prevent incomplete sanitization (e.g., `<<script>script>`)
  // and resolve CodeQL "IncompleteHtmlAttributeSanitization" warnings.
  do {
    prev = text
    text = text.replace(RE_ANY_TAG, '')
  } while (text !== prev)

  // ⚡ Bolt: Decode HTML entities in a single pass.
  // We use the capture group `p1` (which contains the entity name or number without the `&` and `;`)
  // to avoid invoking `entity.match(...)` internally, which creates secondary string allocations.
  if (text.indexOf('&') !== -1) {
    text = text.replace(RE_ENTITIES, (entity, p1) => {
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
  text = text.replace(RE_WHITESPACE, ' ').trim()

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
