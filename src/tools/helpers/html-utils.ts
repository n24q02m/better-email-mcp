/**
 * HTML to Clean Text Utilities
 * Strips HTML tags, CSS, scripts and returns clean text for LLM consumption
 */

import { convert } from 'html-to-text'

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
 * Fast Regex-based HTML Snippet Extractor
 * Extracts a short snippet from an HTML payload without full DOM parsing.
 * Optimized for performance on large payloads (e.g. large email bodies).
 */
export function fastExtractHtmlSnippet(html: string, maxLength = 200): string {
  if (!html) return ''

  // Strip style and script tags (and their contents) FIRST from the entire string.
  // If we truncate before stripping, a large <style> block might be cut off,
  // leaving the closing </style> tag missing, causing the regex to fail and leaking CSS as text.
  // We use [\s\S]*? to match contents, and allow optional whitespace in the closing tag.
  let chunk = html.replace(/<(style|script)[^>]*>[\s\S]*?<\/\1\s*>/gi, '')

  // Now extract a chunk much larger than the desired snippet to ensure we have enough content
  // after stripping remaining tags, but small enough to avoid processing the whole large document.
  const chunkLength = maxLength * 20
  chunk = chunk.substring(0, chunkLength)

  // Strip all other HTML tags, including malformed ones without a closing bracket (e.g. `<script`)
  chunk = chunk.replace(/<[^>]*>?/g, ' ')

  // Decode common HTML entities.
  // Note: We MUST replace &amp; last to prevent double-unescaping vulnerabilities
  // (e.g., &amp;lt; -> &lt; -> <).
  chunk = chunk
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&')

  // Clean up whitespace
  const cleaned = chunk.replace(/\s+/g, ' ').trim()

  if (cleaned.length <= maxLength) return cleaned
  return `${cleaned.substring(0, maxLength)}...`
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
