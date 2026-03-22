import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { tenders, tenderDocuments, tenderSections, tenderActivities } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { TENDER_REVIEW_REPORT_SYSTEM, TENDER_REVIEW_REPORT_USER } from '@/lib/ai/prompts'
import { runAnthropicCompletionDetailed, isAgentAvailable } from '@/lib/ai/run'
import { getCompanyContext } from '@/lib/company/context'
import { sanitizeAndWrapTenderReviewHtml } from '@/lib/analysis/sanitize-report-html'
import { tenderMetadataJson } from '@/lib/tenders/tender-metadata-json'

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

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
    if (!isAgentAvailable('tender_review_report')) {
      return NextResponse.json(
        { error: 'AI-provider voor reviewrapport niet geconfigureerd (ANTHROPIC_API_KEY)' },
        { status: 503 }
      )
    }

    const { id } = await params

    const [tender] = await db.select().from(tenders).where(eq(tenders.id, id))
    if (!tender) return NextResponse.json({ error: 'Tender niet gevonden' }, { status: 404 })

    const sections = await db
      .select()
      .from(tenderSections)
      .where(eq(tenderSections.tenderId, id))
      .orderBy(asc(tenderSections.orderIndex))

    const minChars = 50
    const withContent = sections.filter((s) => (s.content || '').trim().length >= minChars)
    if (withContent.length === 0) {
      return NextResponse.json(
        {
          error:
            'Geen voldoende gevulde secties. Schrijf of genereer eerst inhoud in minstens één sectie (minimaal ca. 50 tekens) en sla op.',
        },
        { status: 400 }
      )
    }

    await db
      .update(tenders)
      .set({ reviewReportStatus: 'processing', updatedAt: new Date() })
      .where(eq(tenders.id, id))

    let sectionsPayload = withContent
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
        '\n\n[... sectieteksten ingekort; beoordeel de beschikbare fragmenten ...]'
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
        '(Geen geanalyseerde documenten beschikbaar. Beoordeel op basis van de sectieteksten en algemene infra-tenderpraktijk; vermeld expliciet waar criteria ontbreken.)'
    } else {
      const maxCrit = 120_000
      if (criteriaAndDocumentsPayload.length > maxCrit) {
        criteriaAndDocumentsPayload =
          criteriaAndDocumentsPayload.slice(0, maxCrit) +
          '\n\n[... documentcontext ingekort ...]'
      }
    }

    const analysisReportExcerpt = tender.analysisReportHtml
      ? stripHtmlToPlain(tender.analysisReportHtml, 14_000)
      : undefined

    const companyContext = await getCompanyContext()
    const { text: raw, stopReason } = await runAnthropicCompletionDetailed(
      'tender_review_report',
      TENDER_REVIEW_REPORT_SYSTEM,
      TENDER_REVIEW_REPORT_USER({
        tenderJson: tenderMetadataJson(tender),
        sectionsPayload,
        criteriaAndDocumentsPayload,
        analysisReportExcerpt,
        companyContext: companyContext || undefined,
      }),
      { maxTokens: 16384 }
    )

    if (stopReason === 'max_tokens') {
      console.error('Tender review report: Anthropic stop_reason=max_tokens (output truncated)')
      await db
        .update(tenders)
        .set({ reviewReportStatus: 'failed', updatedAt: new Date() })
        .where(eq(tenders.id, id))
      return NextResponse.json(
        {
          error:
            'Het rapport werd afgekapt door de tokenlimiet. Probeer het opnieuw; bij herhaald falen: kortere sectieteksten of minder documentcontext.',
        },
        { status: 500 }
      )
    }

    if (stopReason === 'refusal') {
      await db
        .update(tenders)
        .set({ reviewReportStatus: 'failed', updatedAt: new Date() })
        .where(eq(tenders.id, id))
      return NextResponse.json(
        { error: 'Het model weigerde het reviewrapport te genereren. Pas de inhoud aan of probeer later opnieuw.' },
        { status: 500 }
      )
    }

    const html = sanitizeAndWrapTenderReviewHtml(raw || '')
    const now = new Date()

    if (visibleTextLength(html) < 200) {
      console.error('Tender review report: empty or too short after sanitize', {
        stopReason,
        rawLength: raw?.length ?? 0,
        htmlLength: html.length,
        rawPreview: (raw || '').slice(0, 400),
      })
      await db
        .update(tenders)
        .set({ reviewReportStatus: 'failed', updatedAt: new Date() })
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
        reviewReportHtml: html,
        reviewReportStatus: 'done',
        reviewReportGeneratedAt: now,
        updatedAt: now,
      })
      .where(eq(tenders.id, id))
      .returning()

    await db.insert(tenderActivities).values({
      tenderId: id,
      userId,
      activityType: 'tender_review_report',
      description: 'Reviewrapport (HTML) gegenereerd',
      metadata: { stopReason: stopReason ?? undefined },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Tender review report error:', error)
    const msg = error instanceof Error ? error.message : String(error)
    const likelyMissingMigration = /review_report|42703|column .* does not exist/i.test(msg)
    if (db) {
      try {
        const { id } = await params
        await db
          .update(tenders)
          .set({ reviewReportStatus: 'failed', updatedAt: new Date() })
          .where(eq(tenders.id, id))
      } catch {
        /* ignore */
      }
    }
    return NextResponse.json(
      {
        error: likelyMissingMigration
          ? 'Database mist review-kolommen. Voer migraties uit (bijv. npm run db:migrate of drizzle-kit push) en probeer opnieuw.'
          : 'Genereren van reviewrapport mislukt',
      },
      { status: 500 }
    )
  }
}
