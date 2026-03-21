/**
 * Haalt HTML uit modeloutput.
 * Claude voegt vaak een inleiding toe vóór ```html; de oude regex vereiste ``` op regel 1 en faalde.
 */
export function extractTenderAnalysisHtml(raw: string): string {
  const s = raw.trim()
  // Langste ```html ... ```-blok met echte tags (meerdere fences mogelijk)
  const fenceRe = /```(?:html)?\s*\n([\s\S]*?)```/gi
  let best = ''
  let m: RegExpExecArray | null
  while ((m = fenceRe.exec(s)) !== null) {
    const inner = m[1].trim()
    if (inner.includes('<') && inner.length > best.length) best = inner
  }
  if (best) return best

  const articleMatch = s.match(/<article[\s\S]*<\/article>/i)
  if (articleMatch) return articleMatch[0].trim()

  return s
}
