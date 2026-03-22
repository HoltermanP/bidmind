/**
 * TenderNed levert soms EU-publicatiecodes (EF16, EF25) of korte interne codes (EFE1-achtig)
 * in het veld aanbestedingNaam. Die zijn geen projectnamen; we vallen terug op de opdrachtomschrijving.
 */

const MAX_TITLE_LEN = 200

/** EU-/formuliercodes en korte typecodes die geen projectnaam zijn. */
export function looksLikePublicationOrTypeCode(name: string): boolean {
  const t = name.trim()
  if (!t) return true

  // TenderNed: typecode + letterlijk "project" (geen inhoudelijke naam)
  if (/^(EF\d{2}|EFE\d+)\s+project$/i.test(t)) return true

  // Standaard EU-aankondigingscodes op TenderNed (eForms / richtlijn)
  if (/^EF\d{2}$/i.test(t)) return true
  // Veelvoorkomend patroon EFE + cijfers
  if (/^EFE\d+$/i.test(t)) return true

  // Korte code: geen spaties, wel cijfers, alleen A-Z/0-9 (geen normale woorden met kleine letters)
  if (!/\s/.test(t) && /\d/.test(t) && t.length <= 12 && /^[A-Z0-9]+$/i.test(t)) {
    if (t.length <= 8) return true
  }

  // Zeer korte token zonder spaties (≤6) die alleen uit hoofdletters/cijfers bestaat — vaak interne code
  if (t.length <= 6 && !/\s/.test(t) && /^[A-Z0-9][A-Z0-9.-]*$/i.test(t) && t === t.toUpperCase()) {
    return true
  }

  return false
}

/** Eerste zinvolle regel uit opdrachtbeschrijving als leesbare titel. */
export function firstPhraseFromOpdrachtbeschrijving(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const lines = raw
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  for (const line of lines) {
    const unquoted = line.replace(/^["'«»„]+|["'»”]+$/, '').trim()
    if (unquoted.length < 8) continue
    if (looksLikePublicationOrTypeCode(unquoted)) continue
    return truncate(unquoted, MAX_TITLE_LEN)
  }

  const first = lines[0]?.replace(/^["'«»„]+|["'»”]+$/, '').trim()
  if (first && first.length >= 8) return truncate(first, MAX_TITLE_LEN)
  return null
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1).trimEnd() + '…'
}

/**
 * Kiest een leesbare project-/aanbestedingsnaam voor weergave en opslag.
 * Gebruik `opdrachtBeschrijving` van TenderNed wanneer `aanbestedingNaam` een code is.
 */
export function resolveProjectTitleFromTenderNed(aanbestedingNaam: string, opdrachtBeschrijving?: string | null): string {
  const raw = (aanbestedingNaam || '').trim()
  if (raw && !looksLikePublicationOrTypeCode(raw)) return raw

  const fromDesc = firstPhraseFromOpdrachtbeschrijving(opdrachtBeschrijving ?? null)
  if (fromDesc) return fromDesc

  // Geen bruikbare titel: niet terugvallen op ruwe code (bijv. EF16 of EFE1 project)
  return 'Onbekende aanbesteding'
}

/** Titel voor UI en exports: zelfde filters als bij import (ook voor oude DB-records met typecodes). */
export function displayTenderTitle(storedTitle: string | null | undefined): string {
  return resolveProjectTitleFromTenderNed(storedTitle ?? '', null)
}
