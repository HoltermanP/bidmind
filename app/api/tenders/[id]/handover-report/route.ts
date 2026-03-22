import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { tenders, tenderDocuments, tenderSections, tenderActivities } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { HANDOVER_REPORT_SYSTEM, HANDOVER_REPORT_USER } from '@/lib/ai/prompts'
import { runAnthropicCompletionDetailed, isAgentAvailable } from '@/lib/ai/run'
import { getCompanyContext } from '@/lib/company/context'
import { sanitizeAndWrapHandoverPlanHtml, sanitizeAndWrapHandoverPresentationHtml } from '@/lib/analysis/sanitize-report-html'
import { parseHandoverReportResponse } from '@/lib/analysis/parse-handover-report'

export const maxDuration = 120

function visibleTextLength(html: string): number {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim().length
}

function stripHtmlToPlain(html: string, maxChars: number): string {
  const plain = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (plain.length <= maxChars) return plain
  return plain.slice(0, maxChars) + ' […]'
}

function tenderToJson(t: typeof tenders.$inferSelect) {
  return JSON.stringify(
    {
      title: t.title,
      referenceNumber: t.referenceNumber,
      contractingAuthority: t.contractingAuthority,
      procedureType: t.procedureType,
      estimatedValue: t.estimatedValue,
      cpvCodes: t.cpvCodes,
      publicationDate: t.publicationDate?.toISOString?.() ?? t.publicationDate,
      deadlineQuestions: t.deadlineQuestions?.toISOString?.() ?? t.deadlineQuestions,
      deadlineSubmission: t.deadlineSubmission?.toISOString?.() ?? t.deadlineSubmission,
      tendernetUrl: t.tendernetUrl,
      status: t.status,
    },
    null,
    2
  )
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
    if (!isAgentAvailable('handover_report')) {
      return NextResponse.json(
        { error: 'AI-provider voor Overdracht niet geconfigureerd (ANTHROPIC_API_KEY)' },
        { status: 503 }
      )
    }

    const { id } = await params

    const [tender] = await db.select().from(tenders).where(eq(tenders.id, id))
    if (!tender) return NextResponse.json({ error: 'Tender niet gevonden' }, { status: 404 })

    if (tender.status !== 'won') {
      return NextResponse.json(
        {
          error:
            'Overdracht is alleen beschikbaar voor gewonnen tenders. Zet de pipeline op “Gewonnen” en probeer opnieuw.',
        },
        { status: 400 }
      )
    }

    const sections = await db
      .select()
      .from(tenderSections)
      .where(eq(tenderSections.tenderId, id))
      .orderBy(asc(tenderSections.orderIndex))

    /** Alle secties met minstens enige inhoud; één korte sectie is voldoende, meerdere secties gaan allemaal mee. */
    const sectionsWithContent = sections.filter((s) => (s.content || '').trim().length > 0)
    if (sectionsWithContent.length === 0) {
      return NextResponse.json(
        {
          error:
            'Geen secties met inhoud. Vul minstens één sectie op het tabblad Aanbieding (ook een korte tekst volstaat).',
        },
        { status: 400 }
      )
    }

    await db
      .update(tenders)
      .set({ handoverReportStatus: 'processing', updatedAt: new Date() })
      .where(eq(tenders.id, id))

    let sectionsPayload = sectionsWithContent
      .map((s) =>
        JSON.stringify(
          {
            titel: s.title,
            type: s.sectionType,
            status: s.status,
            woorden: s.wordCount,
            inhoud: s.content,
          },
          null,
          2
        )
      )
      .join('\n\n---\n\n')

    const maxSectionChars = 200_000
    if (sectionsPayload.length > maxSectionChars) {
      sectionsPayload =
        sectionsPayload.slice(0, maxSectionChars) +
        '\n\n[... sectieteksten ingekort ...]'
    }

    const docs = await db.select().from(tenderDocuments).where(eq(tenderDocuments.tenderId, id))
    const analyzed = docs.filter((d) => d.analysisStatus === 'done' && d.analysisJson)

    let criteriaAndDocumentsPayload = analyzed
      .map((d) =>
        JSON.stringify(
          {
            bestand: d.fileName,
            type: d.documentType,
            samenvatting: d.analysisSummary,
            award_criteria: (d.analysisJson as { award_criteria?: unknown })?.award_criteria,
            key_requirements: (d.analysisJson as { key_requirements?: unknown })?.key_requirements,
            risks: (d.analysisJson as { risks?: unknown })?.risks,
          },
          null,
          2
        )
      )
      .join('\n\n---\n\n')

    if (!criteriaAndDocumentsPayload.trim()) {
      criteriaAndDocumentsPayload =
        '(Geen geanalyseerde documenten beschikbaar. Werk met de sectieteksten en algemene infra-praktijk; vermeld expliciet waar brondata ontbreken.)'
    } else {
      const maxCrit = 120_000
      if (criteriaAndDocumentsPayload.length > maxCrit) {
        criteriaAndDocumentsPayload =
          criteriaAndDocumentsPayload.slice(0, maxCrit) + '\n\n[... documentcontext ingekort ...]'
      }
    }

    const analysisReportExcerpt = tender.analysisReportHtml
      ? stripHtmlToPlain(tender.analysisReportHtml, 14_000)
      : undefined
    const reviewReportExcerpt = tender.reviewReportHtml
      ? stripHtmlToPlain(tender.reviewReportHtml, 12_000)
      : undefined

    const companyContext = await getCompanyContext()
    const { text: raw, stopReason } = await runAnthropicCompletionDetailed(
      'handover_report',
      HANDOVER_REPORT_SYSTEM,
      HANDOVER_REPORT_USER({
        tenderJson: tenderToJson(tender),
        sectionsPayload,
        criteriaAndDocumentsPayload,
        analysisReportExcerpt,
        reviewReportExcerpt,
        companyContext: companyContext || undefined,
      }),
      { maxTokens: 16384, jsonMode: true }
    )

    if (stopReason === 'max_tokens') {
      console.error('Handover report: Anthropic stop_reason=max_tokens (output truncated)')
      await db
        .update(tenders)
        .set({ handoverReportStatus: 'failed', updatedAt: new Date() })
        .where(eq(tenders.id, id))
      return NextResponse.json(
        {
          error:
            'De output werd afgekapt door de tokenlimiet. Probeer het opnieuw; bij herhaald falen: kortere sectieteksten.',
        },
        { status: 500 }
      )
    }

    if (stopReason === 'refusal') {
      await db
        .update(tenders)
        .set({ handoverReportStatus: 'failed', updatedAt: new Date() })
        .where(eq(tenders.id, id))
      return NextResponse.json(
        { error: 'Het model weigerde het overdrachtsrapport te genereren. Probeer later opnieuw of pas de brondata aan.' },
        { status: 500 }
      )
    }

    const parsed = parseHandoverReportResponse(raw || '')
    const planHtml = sanitizeAndWrapHandoverPlanHtml(parsed.planHtml)
    const presentationHtml = sanitizeAndWrapHandoverPresentationHtml(parsed.presentationHtml)
    const now = new Date()

    if (visibleTextLength(planHtml) < 300 || visibleTextLength(presentationHtml) < 120) {
      console.error('Handover report: empty or too short after sanitize', {
        stopReason,
        rawLength: raw?.length ?? 0,
        planLen: planHtml.length,
        presLen: presentationHtml.length,
        rawPreview: (raw || '').slice(0, 400),
      })
      await db
        .update(tenders)
        .set({ handoverReportStatus: 'failed', updatedAt: new Date() })
        .where(eq(tenders.id, id))
      return NextResponse.json(
        {
          error:
            'Het model leverde geen bruikbaar plan en/of presentatie op. Controleer of Anthropic bereikbaar is en probeer opnieuw te genereren.',
        },
        { status: 500 }
      )
    }

    const [updated] = await db
      .update(tenders)
      .set({
        handoverPlanHtml: planHtml,
        handoverPresentationHtml: presentationHtml,
        handoverReportStatus: 'done',
        handoverReportGeneratedAt: now,
        updatedAt: now,
      })
      .where(eq(tenders.id, id))
      .returning()

    await db.insert(tenderActivities).values({
      tenderId: id,
      userId,
      activityType: 'tender_handover_report',
      description: 'Overdracht: implementatieplan en presentatie gegenereerd',
      metadata: { stopReason: stopReason ?? undefined },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Handover report error:', error)
    const msg = error instanceof Error ? error.message : String(error)
    const likelyMissingMigration = /handover|42703|column .* does not exist/i.test(msg)
    if (db) {
      try {
        const { id } = await params
        await db
          .update(tenders)
          .set({ handoverReportStatus: 'failed', updatedAt: new Date() })
          .where(eq(tenders.id, id))
      } catch {
        /* ignore */
      }
    }
    return NextResponse.json(
      {
        error: likelyMissingMigration
          ? 'Database mist overdracht-kolommen. Voer migraties uit (npm run db:migrate of drizzle-kit push) en probeer opnieuw.'
          : 'Genereren van overdrachtsrapport mislukt',
      },
      { status: 500 }
    )
  }
}
