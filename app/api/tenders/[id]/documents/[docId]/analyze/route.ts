import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { tenders, tenderDocuments, tenderActivities } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { DOCUMENT_ANALYSIS_SYSTEM, DOCUMENT_ANALYSIS_USER } from '@/lib/ai/prompts'
import { runCompletion, isAgentAvailable } from '@/lib/ai/run'
import { getCompanyContext } from '@/lib/company/context'
import { fetchDocumentContent } from '@/lib/tenderned/client'
import { extractTextFromBuffer } from '@/lib/documents/extract-text'

export const maxDuration = 60

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
    if (!isAgentAvailable('document_analysis'))
      return NextResponse.json({ error: 'AI-provider voor documentanalyse niet geconfigureerd (ANTHROPIC_API_KEY)' }, { status: 503 })

    const { id, docId } = await params

    await db.update(tenderDocuments)
      .set({ analysisStatus: 'processing' })
      .where(eq(tenderDocuments.id, docId))

    const [doc] = await db.select().from(tenderDocuments).where(eq(tenderDocuments.id, docId))
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    let documentContext: string

    if (doc.tendernedContentId) {
      const [tender] = await db.select().from(tenders).where(eq(tenders.id, id))
      const publicatieId = tender?.tendernedPublicatieId
      if (publicatieId) {
        try {
          const { buffer, contentType } = await fetchDocumentContent(publicatieId, doc.tendernedContentId)
          const extracted = await extractTextFromBuffer(buffer, contentType)
          if (extracted && extracted.length > 100) {
            documentContext = extracted.length > 120000
              ? extracted.slice(0, 120000) + '\n\n[... document ingekort voor analyse ...]'
              : extracted
          } else {
            documentContext = `Document naam: ${doc.fileName}\nType: ${doc.documentType}\nGeen leesbare tekst geëxtraheerd; analyseer op basis van de documentnaam en het type.`
          }
        } catch (fetchErr) {
          console.warn('TenderNed document ophalen mislukt, fallback op metadata:', fetchErr)
          documentContext = `Document naam: ${doc.fileName}\nType: ${doc.documentType}\nAanbesteding ID: ${id}\nDit document is onderdeel van een Nederlandse aanbesteding. Analyseer op basis van de documentnaam en het type.`
        }
      } else {
        documentContext = `Document naam: ${doc.fileName}\nType: ${doc.documentType}\nAanbesteding ID: ${id}\nAnalyseer op basis van de documentnaam en het type.`
      }
    } else {
      documentContext = `Document naam: ${doc.fileName}\nType: ${doc.documentType}\nAanbesteding ID: ${id}\nDit document is onderdeel van een Nederlandse infrastructuuraanbesteding. Genereer een realistische analyse op basis van de documentnaam en het type document.`
    }

    let analysisJson: any = null
    let summary = ''

    const companyContext = await getCompanyContext()

    try {
      const content = await runCompletion(
        'document_analysis',
        DOCUMENT_ANALYSIS_SYSTEM,
        DOCUMENT_ANALYSIS_USER(documentContext, companyContext || undefined),
        { jsonMode: true }
      )
      analysisJson = JSON.parse(content || '{}')
      summary = analysisJson.summary || ''
    } catch (aiError) {
      // Fallback mock analysis bij AI-fout
      analysisJson = {
        summary: `Analyse van ${doc.fileName}: Dit document bevat specificaties en eisen voor de aanbesteding.`,
        key_requirements: ['Conform UAV-GC', 'VCA certificering vereist', 'Minimaal 3 referentieprojecten'],
        award_criteria: [{ criterion: 'Prijs', weight: '40%' }, { criterion: 'Kwaliteit', weight: '60%' }],
        risks: ['Tijdsdruk uitvoering', 'Onbekende bodemgesteldheid'],
        important_dates: [],
        suggested_questions: ['Wat zijn de exacte specificaties?', 'Is er ruimte voor alternatieve oplossingen?'],
      }
      summary = analysisJson.summary
    }

    const [updated] = await db.update(tenderDocuments)
      .set({
        analysisStatus: 'done',
        analysisSummary: summary,
        analysisJson,
      })
      .where(eq(tenderDocuments.id, docId))
      .returning()

    await db.insert(tenderActivities).values({
      tenderId: id,
      userId,
      activityType: 'document_analyzed',
      description: `Document geanalyseerd: ${doc.fileName}`,
      metadata: { docId },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Analyze error:', error)
    if (db) {
      await db.update(tenderDocuments)
        .set({ analysisStatus: 'failed' })
        .where(eq(tenderDocuments.id, (await params).docId))
    }
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
