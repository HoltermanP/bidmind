import sanitizeHtml from 'sanitize-html'
import { extractTenderAnalysisHtml } from '@/lib/analysis/extract-html'

const ALLOWED_TAGS = [
  'article',
  'section',
  'header',
  'main',
  'footer',
  'nav',
  'h1',
  'h2',
  'h3',
  'h4',
  'p',
  'ul',
  'ol',
  'li',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'caption',
  'colgroup',
  'col',
  'strong',
  'em',
  'b',
  'i',
  'blockquote',
  'br',
  'hr',
  'span',
  'div',
  'a',
  'code',
  'pre',
]

export function sanitizeAndWrapTenderAnalysisHtml(rawModelOutput: string): string {
  const extracted = extractTenderAnalysisHtml(rawModelOutput)
  const cleaned = sanitizeHtml(extracted, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      '*': ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
    },
  })

  const trimmed = cleaned.trim()
  if (/^<article\b/i.test(trimmed)) return trimmed
  return `<article class="tender-analysis-report">${trimmed}</article>`
}

export function sanitizeAndWrapTenderReviewHtml(rawModelOutput: string): string {
  const extracted = extractTenderAnalysisHtml(rawModelOutput)
  const cleaned = sanitizeHtml(extracted, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      '*': ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
    },
  })

  const trimmed = cleaned.trim()
  if (/^<article\b/i.test(trimmed)) return trimmed
  return `<article class="tender-review-report">${trimmed}</article>`
}

export function sanitizeAndWrapHandoverPlanHtml(rawModelOutput: string): string {
  const extracted = extractTenderAnalysisHtml(rawModelOutput)
  const cleaned = sanitizeHtml(extracted, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      '*': ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
    },
  })
  const trimmed = cleaned.trim()
  if (/^<article\b/i.test(trimmed)) return trimmed
  return `<article class="tender-handover-plan">${trimmed}</article>`
}

export function sanitizeAndWrapHandoverPresentationHtml(rawModelOutput: string): string {
  const extracted = extractTenderAnalysisHtml(rawModelOutput)
  const cleaned = sanitizeHtml(extracted, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      '*': ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
    },
  })
  const trimmed = cleaned.trim()
  if (/^<article\b/i.test(trimmed)) return trimmed
  return `<article class="tender-handover-presentation">${trimmed}</article>`
}
