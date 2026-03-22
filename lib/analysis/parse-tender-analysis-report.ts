import { extractTenderAnalysisHtml } from '@/lib/analysis/extract-html'

function clampInt(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)))
}

/**
 * Parseert de output van de Analyse Agent: bij voorkeur JSON met `estimated_win_probability` en `html`,
 * anders fallback naar legacy puur-HTML output.
 */
export function parseTenderAnalysisReportResponse(raw: string): {
  html: string
  estimatedWinProbability: number | null
} {
  const trimmed = raw.trim()

  const tryParseObject = (obj: unknown): { html: string; estimatedWinProbability: number | null } | null => {
    if (!obj || typeof obj !== 'object') return null
    const rec = obj as Record<string, unknown>
    const htmlField = rec.html
    if (typeof htmlField !== 'string' || !htmlField.includes('<')) return null
    const rawEst = rec.estimated_win_probability ?? rec.estimatedWinProbability
    let estimatedWinProbability: number | null = null
    if (typeof rawEst === 'number' && Number.isFinite(rawEst)) {
      estimatedWinProbability = clampInt(rawEst, 0, 100)
    } else if (typeof rawEst === 'string' && rawEst.trim() !== '') {
      const n = Number(rawEst.replace(',', '.').replace('%', '').trim())
      if (Number.isFinite(n)) estimatedWinProbability = clampInt(n, 0, 100)
    }
    return { html: htmlField, estimatedWinProbability }
  }

  const jsonFence = /^```(?:json)?\s*\n([\s\S]*?)```/m.exec(trimmed)
  const jsonCandidate = jsonFence ? jsonFence[1].trim() : trimmed

  if (jsonCandidate.startsWith('{')) {
    try {
      const parsed = JSON.parse(jsonCandidate) as unknown
      const out = tryParseObject(parsed)
      if (out) return out
    } catch {
      // probeer object uit tekst met extra voor/na
    }
  }

  const jsonMatch = trimmed.match(/\{[\s\S]*"html"\s*:[\s\S]*\}/)
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
    html: extractTenderAnalysisHtml(trimmed),
    estimatedWinProbability: null,
  }
}
