import type { TenderNedPublicatie } from './types'

/**
 * `true` als de sluitingsdatum/tijd in het verleden ligt.
 * Ongeldige of ontbrekende string: niet als verlopen (import toestaan).
 */
export function isSluitingsDatumExpired(sluitingsDatum: string | null | undefined): boolean {
  if (sluitingsDatum == null || !String(sluitingsDatum).trim()) return false
  const t = new Date(sluitingsDatum).getTime()
  if (Number.isNaN(t)) return false
  return t < Date.now()
}

/**
 * Lijst-response van TenderNed: eerst expliciete sluitingsdatum, anders `aantalDagenTotSluitingsDatum &lt; 0`.
 */
export function isTenderNedPublicationExpiredOnList(
  pub: Pick<TenderNedPublicatie, 'sluitingsDatum' | 'aantalDagenTotSluitingsDatum'>
): boolean {
  const raw = pub.sluitingsDatum
  if (raw != null && String(raw).trim()) {
    const t = new Date(raw).getTime()
    if (!Number.isNaN(t)) return t < Date.now()
  }
  if (pub.aantalDagenTotSluitingsDatum != null) {
    return pub.aantalDagenTotSluitingsDatum < 0
  }
  return false
}
