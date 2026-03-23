import { db } from '@/lib/db'
import { tenders } from '@/lib/db/schema'
import { desc, eq, inArray } from 'drizzle-orm'
import { getCompanyContext } from '@/lib/company/context'
import { runCompletion, isAgentAvailable } from '@/lib/ai/run'
import { parseAiJsonObject } from '@/lib/ai/parse-ai-json'
export type IntakeSuitabilityTier = 'low' | 'medium' | 'high'

/** Maximaal dit aantal tenders houdt een opgeslagen geschiktheidsscore (nieuwste op createdAt). */
export const AUTO_INTAKE_SUITABILITY_NEWEST_LIMIT = 20

const INTAKE_FIELDS_CLEARED = {
  intakeSuitabilityTier: null as null,
  intakeSuitabilityScore: null as null,
  intakeSuitabilitySummary: null as null,
  intakeSuitabilityStatus: 'pending' as const,
  intakeSuitabilityGeneratedAt: null as null,
}

/** Kortere omschrijving in de prompt dan voorheen → minder inputtokens, zelfde model. */
const INTAKE_DESCRIPTION_MAX_CHARS = 3500

export interface TenderBriefForIntake {
  title: string
  contractingAuthority: string | null
  referenceNumber: string | null
  procedureType: string | null
  cpvCodes: string[] | null
  tenderDescription: string | null
}

const SYSTEM_PROMPT = `Je bent een intake-assistent voor Nederlandse aanbestedingen.
Op basis van de bedrijfscontext en de tendergegevens beoordeel je hoe goed deze opdracht past bij het bedrijf (geschiktheid om mee te doen / te tenderen).

Antwoord uitsluitend met een JSON-object met exact deze keys:
- "tier": één van "low", "medium", "high"
  - low = slechte tot matige match; twijfel of het de moeite waard is
  - medium = redelijke match; onderzoek verder
  - high = sterke match met kerncompetenties en ervaring
- "score": geheel getal 0–100 (0 = geen match, 100 = uitstekende match)
- "summary": korte toelichting in het Nederlands, maximaal 3 zinnen, concreet (waarom deze tier/score)

Gebruik alleen de gegeven tekst; verzin geen feiten over het bedrijf die niet in de bedrijfscontext staan.`

function normalizeTier(raw: unknown): IntakeSuitabilityTier | null {
  const s = String(raw ?? '')
    .toLowerCase()
    .trim()
  if (s === 'high' || s === 'hoog') return 'high'
  if (s === 'medium' || s === 'middel' || s === 'gemiddeld') return 'medium'
  if (s === 'low' || s === 'laag') return 'low'
  return null
}

function clampScore(n: unknown): number {
  const x = typeof n === 'number' ? n : parseInt(String(n), 10)
  if (Number.isNaN(x)) return 0
  return Math.max(0, Math.min(100, x))
}

function buildTenderBriefText(brief: TenderBriefForIntake): string {
  const lines: string[] = []
  lines.push(`Titel: ${brief.title}`)
  if (brief.referenceNumber) lines.push(`Referentie/kenmerk: ${brief.referenceNumber}`)
  if (brief.contractingAuthority) lines.push(`Aanbestedende dienst: ${brief.contractingAuthority}`)
  if (brief.procedureType) lines.push(`Procedure/type: ${brief.procedureType}`)
  if (brief.cpvCodes?.length) lines.push(`CPV-code(s): ${brief.cpvCodes.join(', ')}`)
  if (brief.tenderDescription?.trim()) {
    lines.push(
      `Omschrijving (bron: TenderNed / publicatie):\n${brief.tenderDescription.trim().slice(0, INTAKE_DESCRIPTION_MAX_CHARS)}`
    )
  }
  return lines.join('\n')
}

export async function evaluateIntakeSuitability(brief: TenderBriefForIntake): Promise<{
  tier: IntakeSuitabilityTier
  score: number
  summary: string
}> {
  const company = await getCompanyContext()
  const user = `${company ? `${company}\n\n` : '--- Geen bedrijfscontext ingevuld; wees voorzichtig en kies conservatieve scores. ---\n\n'}--- Tender ---\n${buildTenderBriefText(brief)}`

  const raw = await runCompletion('intake_suitability', SYSTEM_PROMPT, user, { jsonMode: true })
  const obj = parseAiJsonObject(raw)
  let tier = normalizeTier(obj.tier)
  const score = clampScore(obj.score)
  let summary = typeof obj.summary === 'string' ? obj.summary.trim() : ''
  if (!summary) summary = 'Geen toelichting ontvangen.'
  if (summary.length > 1200) summary = `${summary.slice(0, 1197)}…`

  if (!tier) {
    if (score >= 67) tier = 'high'
    else if (score >= 34) tier = 'medium'
    else tier = 'low'
  }

  return { tier, score, summary }
}

/**
 * Houdt intake-geschiktheid in lijn met “alleen de N nieuwste tenders”:
 * 1. Wist score/status voor alle tenders buiten de top N (op createdAt, daarna id).
 * 2. Voert voor elke tender in de top N met status pending of failed een beoordeling uit (sequential).
 *
 * Roep aan na TenderNed-import of na het aanmaken van een tender, zodat nieuwe tenders worden beoordeeld
 * en oudere automatisch uit de “score-venster” vallen.
 */
export async function reconcileIntakeSuitabilityForNewestLimit(): Promise<void> {
  if (!db) return

  const ordered = await db
    .select({
      id: tenders.id,
      intakeSuitabilityStatus: tenders.intakeSuitabilityStatus,
    })
    .from(tenders)
    .orderBy(desc(tenders.createdAt), desc(tenders.id))

  const top = ordered.slice(0, AUTO_INTAKE_SUITABILITY_NEWEST_LIMIT)
  const outsideIds = ordered.slice(AUTO_INTAKE_SUITABILITY_NEWEST_LIMIT).map((r) => r.id)

  if (outsideIds.length > 0) {
    await db
      .update(tenders)
      .set({
        ...INTAKE_FIELDS_CLEARED,
        updatedAt: new Date(),
      })
      .where(inArray(tenders.id, outsideIds))
  }

  for (const row of top) {
    const st = row.intakeSuitabilityStatus
    if (st === 'processing' || st === 'done') continue
    await runIntakeSuitabilityForTenderId(row.id)
  }
}

export function tenderBriefFromTenderRow(row: {
  title: string
  contractingAuthority: string | null
  referenceNumber: string | null
  procedureType: string | null
  cpvCodes: string[] | null
  tenderDescription: string | null
}): TenderBriefForIntake {
  return {
    title: row.title,
    contractingAuthority: row.contractingAuthority,
    referenceNumber: row.referenceNumber,
    procedureType: row.procedureType,
    cpvCodes: row.cpvCodes,
    tenderDescription: row.tenderDescription,
  }
}

/**
 * Zet status op processing, voert de intake-agent uit, schrijft resultaat of failed naar de tender.
 */
export async function runIntakeSuitabilityForTenderId(tenderId: string): Promise<void> {
  if (!db) return

  await db
    .update(tenders)
    .set({
      intakeSuitabilityStatus: 'processing',
      intakeSuitabilityTier: null,
      intakeSuitabilityScore: null,
      updatedAt: new Date(),
    })
    .where(eq(tenders.id, tenderId))

  if (!isAgentAvailable('intake_suitability')) {
    await db
      .update(tenders)
      .set({
        intakeSuitabilityStatus: 'failed',
        intakeSuitabilitySummary: 'Intake-geschiktheid niet uitgevoerd: geen OpenAI API-sleutel geconfigureerd.',
        intakeSuitabilityGeneratedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tenders.id, tenderId))
    return
  }

  try {
    const [row] = await db.select().from(tenders).where(eq(tenders.id, tenderId))
    if (!row) return

    const brief = tenderBriefFromTenderRow(row)
    const { tier, score, summary } = await evaluateIntakeSuitability(brief)

    await db
      .update(tenders)
      .set({
        intakeSuitabilityTier: tier,
        intakeSuitabilityScore: score,
        intakeSuitabilitySummary: summary,
        intakeSuitabilityStatus: 'done',
        intakeSuitabilityGeneratedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tenders.id, tenderId))
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Onbekende fout'
    await db
      .update(tenders)
      .set({
        intakeSuitabilityStatus: 'failed',
        intakeSuitabilitySummary: `Intake-geschiktheid mislukt: ${msg.slice(0, 500)}`,
        intakeSuitabilityGeneratedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tenders.id, tenderId))
  }
}
