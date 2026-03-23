import { db } from '@/lib/db'
import { lessonsLearned, tenderActivities, tenderDocuments, tenders } from '@/lib/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { getCompanyContext } from '@/lib/company/context'
import { runCompletion, isAgentAvailable } from '@/lib/ai/run'
import { parseAiJsonObject } from '@/lib/ai/parse-ai-json'
import { LESSONS_LEARNED_EVAL_SYSTEM, LESSONS_LEARNED_EVAL_USER } from '@/lib/ai/prompts'
import { extractTextFromUploadedDoc } from '@/lib/tenders/uploaded-document-text'
import { fetchDocumentContent } from '@/lib/tenderned/client'
import { extractTextFromBuffer } from '@/lib/documents/extract-text'

const ALLOWED_CATEGORIES = new Set(['Formalia', 'Prijs', 'Kwaliteit', 'Inhoud', 'Organisatie', 'Overig'])
const ALLOWED_IMPACT = new Set(['hoog', 'middel', 'laag'])

function normalizeCategory(raw: unknown): string {
  const s = String(raw ?? '').trim()
  if (ALLOWED_CATEGORIES.has(s)) return s
  return 'Overig'
}

function normalizeImpact(raw: unknown): string | null {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (s === 'high' || s === 'hoog') return 'hoog'
  if (s === 'medium' || s === 'middel' || s === 'gemiddeld') return 'middel'
  if (s === 'low' || s === 'laag') return 'laag'
  if (ALLOWED_IMPACT.has(s)) return s
  return null
}

function clampStr(s: unknown, max: number): string {
  const t = typeof s === 'string' ? s.trim() : String(s ?? '').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function parseLessonItems(raw: Record<string, unknown>): Array<{
  title: string
  category: string
  observation: string
  recommendation: string
  applicabilityHint: string | null
  impact: string | null
  tags: string[] | null
}> {
  let arr: unknown[] = []
  if (Array.isArray(raw.lessons)) arr = raw.lessons
  else if (Array.isArray(raw.items)) arr = raw.items
  else if (Array.isArray(raw)) arr = raw as unknown[]

  const out: Array<{
    title: string
    category: string
    observation: string
    recommendation: string
    applicabilityHint: string | null
    impact: string | null
    tags: string[] | null
  }> = []

  for (const item of arr.slice(0, 25)) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const title = clampStr(o.title, 200)
    const observation = clampStr(o.observation, 4000)
    const recommendation = clampStr(o.recommendation, 4000)
    if (!title || !observation || !recommendation) continue

    const applicabilityRaw = o.applicability_hint ?? o.applicabilityHint
    const hint =
      typeof applicabilityRaw === 'string' && applicabilityRaw.trim()
        ? clampStr(applicabilityRaw, 500)
        : null

    let tags: string[] | null = null
    if (Array.isArray(o.tags)) {
      tags = o.tags
        .map((t) => clampStr(t, 48))
        .filter(Boolean)
        .slice(0, 5)
      if (tags.length === 0) tags = null
    }

    out.push({
      title,
      category: normalizeCategory(o.category),
      observation,
      recommendation,
      applicabilityHint: hint,
      impact: normalizeImpact(o.impact),
      tags,
    })
  }

  return out
}

async function extractFeedbackTextFromDoc(doc: typeof tenderDocuments.$inferSelect): Promise<string | null> {
  if (doc.tendernedContentId && doc.tenderId) {
    const [tender] = await db!.select().from(tenders).where(eq(tenders.id, doc.tenderId))
    const publicatieId = tender?.tendernedPublicatieId
    if (publicatieId) {
      try {
        const { buffer, contentType } = await fetchDocumentContent(publicatieId, doc.tendernedContentId)
        const extracted = await extractTextFromBuffer(buffer, contentType)
        if (extracted?.trim()) {
          return extracted.length > 120_000
            ? extracted.slice(0, 120_000) + '\n\n[... ingekort ...]'
            : extracted
        }
      } catch (e) {
        console.warn('TenderNed-document voor leerpunten ophalen mislukt:', e)
      }
    }
  }
  return extractTextFromUploadedDoc(doc)
}

export async function evaluateLessonsFromDocument(params: {
  tenderId: string
  documentId: string
  userId: string
}): Promise<{ inserted: number; lessons: (typeof lessonsLearned.$inferSelect)[] }> {
  if (!db) throw new Error('Database not configured')
  if (!isAgentAvailable('lessons_learned')) {
    throw new Error('AI-provider voor leerpunten niet geconfigureerd (ANTHROPIC_API_KEY)')
  }

  const [tender] = await db.select().from(tenders).where(eq(tenders.id, params.tenderId))
  if (!tender) throw new Error('Tender niet gevonden')

  const [doc] = await db.select().from(tenderDocuments).where(eq(tenderDocuments.id, params.documentId))
  if (!doc || doc.tenderId !== params.tenderId) throw new Error('Document niet gevonden')

  const feedbackText = await extractFeedbackTextFromDoc(doc)
  if (!feedbackText?.trim()) {
    throw new Error('Geen leesbare tekst uit dit document; upload PDF of DOCX met selecteerbare tekst.')
  }

  const companyContext = await getCompanyContext()
  const userPrompt = LESSONS_LEARNED_EVAL_USER({
    tenderTitle: tender.title,
    authority: tender.contractingAuthority,
    referenceNumber: tender.referenceNumber,
    feedbackDocumentText: feedbackText,
    companyContext: companyContext || undefined,
  })

  const raw = await runCompletion('lessons_learned', LESSONS_LEARNED_EVAL_SYSTEM, userPrompt, { jsonMode: true })
  const obj = parseAiJsonObject(raw)
  const items = parseLessonItems(obj)

  await db.delete(lessonsLearned).where(
    and(eq(lessonsLearned.tenderId, params.tenderId), eq(lessonsLearned.sourceDocumentId, params.documentId))
  )

  if (items.length === 0) {
    await db.insert(tenderActivities).values({
      tenderId: params.tenderId,
      userId: params.userId,
      activityType: 'lessons_learned_evaluated',
      description: `Leerpunten geëvalueerd: ${doc.fileName ?? params.documentId} (0 items)`,
      metadata: { documentId: params.documentId },
    })
    return { inserted: 0, lessons: [] }
  }

  const rows = await db
    .insert(lessonsLearned)
    .values(
      items.map((it) => ({
        tenderId: params.tenderId,
        sourceDocumentId: params.documentId,
        title: it.title,
        category: it.category,
        observation: it.observation,
        recommendation: it.recommendation,
        applicabilityHint: it.applicabilityHint,
        impact: it.impact,
        tags: it.tags ?? undefined,
        createdBy: params.userId,
      }))
    )
    .returning()

  await db.insert(tenderActivities).values({
    tenderId: params.tenderId,
    userId: params.userId,
    activityType: 'lessons_learned_evaluated',
    description: `Leerpunten vastgelegd uit ${doc.fileName ?? 'document'} (${rows.length})`,
    metadata: { documentId: params.documentId, count: rows.length },
  })

  return { inserted: rows.length, lessons: rows }
}

/** Geformatteerde bloktekst voor de Schrijf Agent (recente leerpunten, alle tenders). */
export async function buildLessonsLearnedContextForWriting(limit = 35): Promise<string> {
  if (!db) return ''
  const rows = await db
    .select({
      title: lessonsLearned.title,
      category: lessonsLearned.category,
      recommendation: lessonsLearned.recommendation,
      observation: lessonsLearned.observation,
      impact: lessonsLearned.impact,
    })
    .from(lessonsLearned)
    .orderBy(desc(lessonsLearned.createdAt))
    .limit(limit)

  if (rows.length === 0) return ''

  return rows
    .map((r, i) => {
      const impact = r.impact ? ` [impact: ${r.impact}]` : ''
      return `${i + 1}. **${r.title}** (${r.category})${impact}\n   - Observatie: ${r.observation}\n   - Aanbeveling: ${r.recommendation}`
    })
    .join('\n\n')
}
