/**
 * Parseert JSON uit een AI-antwoord; verwijdert optioneel ```json ... ``` fences
 * (ook als er nog tekst vóór of na de codeblock staat).
 */
export function parseAiJsonObject(content: string): Record<string, unknown> {
  let s = (content ?? '').trim()
  if (!s) throw new Error('Leeg AI-antwoord')
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) s = fence[1].trim()
  return JSON.parse(s) as Record<string, unknown>
}
