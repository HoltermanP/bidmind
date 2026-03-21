import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { tenders, tenderDocuments, tenderActivities } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { TENDER_ANALYSIS_REPORT_SYSTEM, TENDER_ANALYSIS_REPORT_USER } from '@/lib/ai/prompts'
import { runAnthropicCompletionDetailed, isAgentAvailable } from '@/lib/ai/run'
import { getCompanyContext } from '@/lib/company/context'
import { sanitizeAndWrapTenderAnalysisHtml } from '@/lib/analysis/sanitize-report-html'

export const maxDuration = 120

function visibleTextLength(html: string): number {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim().length
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
      goNoGo: t.goNoGo,
      goNoGoReasoning: t.goNoGoReasoning,
    },
    null,
    2
  )
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
    if (!isAgentAvailable('tender_analysis_report')) {
      return NextResponse.json(
        { error: 'AI-provider voor tenderanalyse niet geconfigureerd (ANTHROPIC_API_KEY)' },
        { status: 503 }
      )
    }

    const { id } = await params

    const [tender] = await db.select().from(tenders).where(eq(tenders.id, id))
    if (!tender) return NextResponse.json({ error: 'Tender niet gevonden' }, { status: 404 })

    const docs = await db.select().from(tenderDocuments).where(eq(tenderDocuments.tenderId, id))
    const analyzed = docs.filter((d) => d.analysisStatus === 'done' && d.analysisJson)
    if (analyzed.length === 0) {
      return NextResponse.json(
        { error: 'Geen geanalyseerde documenten. Analyseer eerst minstens één document onder Documenten.' },
        { status: 400 }
      )
    }

    await db
      .update(tenders)
      .set({ analysisReportStatus: 'processing', updatedAt: new Date() })
      .where(eq(tenders.id, id))

    let documentsPayload = analyzed
      .map((d) =>
        JSON.stringify(
          {
            bestand: d.fileName,
            type: d.documentType,
            samenvatting: d.analysisSummary,
            analyse: d.analysisJson,
          },
          null,
          2
        )
      )
      .join('\n\n---\n\n')

    const maxChars = 180_000
    if (documentsPayload.length > maxChars) {
      documentsPayload =
        documentsPayload.slice(0, maxChars) +
        '\n\n[... brondata ingekort voor rapportage; gebruik de beschikbare fragmenten ...]'
    }

    const companyContext = await getCompanyContext()
    const { text: raw, stopReason } = await runAnthropicCompletionDetailed(
      'tender_analysis_report',
      TENDER_ANALYSIS_REPORT_SYSTEM,
      TENDER_ANALYSIS_REPORT_USER({
        tenderJson: tenderToJson(tender),
        documentsPayload,
        companyContext: companyContext || undefined,
      }),
      { maxTokens: 16384 }
    )

    if (stopReason === 'max_tokens') {
      console.error('Tender analysis report: Anthropic stop_reason=max_tokens (output truncated)')
      await db
        .update(tenders)
        .set({ analysisReportStatus: 'failed', updatedAt: new Date() })
        .where(eq(tenders.id, id))
      return NextResponse.json(
        {
          error:
            'Het rapport werd afgekapt door de tokenlimiet. Probeer het opnieuw; bij herhaald falen: minder of kortere documentanalyses in de bron.',
        },
        { status: 500 }
      )
    }

    if (stopReason === 'refusal') {
      await db
        .update(tenders)
        .set({ analysisReportStatus: 'failed', updatedAt: new Date() })
        .where(eq(tenders.id, id))
      return NextResponse.json(
        { error: 'Het model weigerde het rapport te genereren. Pas de brondata aan of probeer later opnieuw.' },
        { status: 500 }
      )
    }

    const html = sanitizeAndWrapTenderAnalysisHtml(raw || '')
    const now = new Date()

    if (visibleTextLength(html) < 200) {
      console.error('Tender analysis report: empty or too short after sanitize', {
        stopReason,
        rawLength: raw?.length ?? 0,
        htmlLength: html.length,
        rawPreview: (raw || '').slice(0, 400),
      })
      await db
        .update(tenders)
        .set({ analysisReportStatus: 'failed', updatedAt: new Date() })
        .where(eq(tenders.id, id))
      return NextResponse.json(
        {
          error:
            'Het model leverde geen bruikbaar HTML-rapport op. Controleer of Anthropic bereikbaar is en probeer opnieuw te genereren.',
        },
        { status: 500 }
      )
    }

    const [updated] = await db
      .update(tenders)
      .set({
        analysisReportHtml: html,
        analysisReportStatus: 'done',
        analysisReportGeneratedAt: now,
        updatedAt: now,
      })
      .where(eq(tenders.id, id))
      .returning()

    await db.insert(tenderActivities).values({
      tenderId: id,
      userId,
      activityType: 'tender_analysis_report',
      description: 'Tenderanalyse (HTML-rapport) gegenereerd',
      metadata: { stopReason: stopReason ?? undefined },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Tender analysis report error:', error)
    if (db) {
      const { id } = await params
      await db
        .update(tenders)
        .set({ analysisReportStatus: 'failed', updatedAt: new Date() })
        .where(eq(tenders.id, id))
    }
    return NextResponse.json({ error: 'Genereren van tenderanalyse mislukt' }, { status: 500 })
  }
}
