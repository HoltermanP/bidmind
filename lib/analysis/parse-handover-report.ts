import { extractTenderAnalysisHtml } from '@/lib/analysis/extract-html'

function tryParseObject(obj: unknown): { planHtml: string; presentationHtml: string } | null {
  if (!obj || typeof obj !== 'object') return null
  const rec = obj as Record<string, unknown>
  const plan =
    (typeof rec.plan_html === 'string' && rec.plan_html) ||
    (typeof rec.planHtml === 'string' && rec.planHtml) ||
    null
  const pres =
    (typeof rec.presentation_html === 'string' && rec.presentation_html) ||
    (typeof rec.presentationHtml === 'string' && rec.presentationHtml) ||
    null
  if (!plan || !plan.includes('<') || !pres || !pres.includes('<')) return null
  return { planHtml: plan, presentationHtml: pres }
}

/**
 * Parseert de JSON-output van de Overdracht Agent (plan + presentatie als HTML-strings).
 */
export function parseHandoverReportResponse(raw: string): {
  planHtml: string
  presentationHtml: string
} {
  const trimmed = raw.trim()

  const jsonFence = /^```(?:json)?\s*\n([\s\S]*?)```/m.exec(trimmed)
  const jsonCandidate = jsonFence ? jsonFence[1].trim() : trimmed

  if (jsonCandidate.startsWith('{')) {
    try {
      const parsed = JSON.parse(jsonCandidate) as unknown
      const out = tryParseObject(parsed)
      if (out) return out
    } catch {
      /* fallback */
    }
  }

  const jsonMatch = trimmed.match(/\{[\s\S]*"(?:plan_html|planHtml)"\s*:[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as unknown
      const out = tryParseObject(parsed)
      if (out) return out
    } catch {
      /* ignore */
    }
  }

  return {
    planHtml: extractTenderAnalysisHtml(trimmed),
    presentationHtml: '<article class="tender-handover-presentation"><p>Geen presentatie geparseerd.</p></article>',
  }
}
