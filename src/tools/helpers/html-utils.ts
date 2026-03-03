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

  // Remove style and script blocks entirely
  let text = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')

  // Replace block elements with spaces
  text = text.replace(/<\/(p|div|br|tr|li|h[1-6])>/gi, ' ')
  text = text.replace(/<br\s*\/?>/gi, ' ')

  // Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '')

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))

  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim()

  if (text.length <= maxLength) return text
  return `${text.substring(0, maxLength)}...`
}
