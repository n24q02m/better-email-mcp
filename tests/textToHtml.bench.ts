import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'
import { bench, describe } from 'vitest'
import { textToHtml } from '../src/tools/helpers/smtp-client.js'

const SANITIZE_OPTIONS = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img'])
}

const MARKED_OPTIONS = { async: false, breaks: true }

function textToHtmlOptimized(text: string): string {
  const rawHtml = marked.parse(text, MARKED_OPTIONS) as string
  return sanitizeHtml(rawHtml, SANITIZE_OPTIONS)
}

describe('textToHtml', () => {
  const text = 'Hello **world**\n\nThis is a test message. [Link](https://example.com)'

  bench('convert text to html (current)', () => {
    textToHtml(text)
  })

  bench('convert text to html (optimized)', () => {
    textToHtmlOptimized(text)
  })
})
