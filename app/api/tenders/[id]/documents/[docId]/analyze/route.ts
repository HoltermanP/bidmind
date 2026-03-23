import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { tenders, tenderDocuments, tenderActivities } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { DOCUMENT_ANALYSIS_SYSTEM, DOCUMENT_ANALYSIS_USER } from '@/lib/ai/prompts'
import { parseAiJsonObject } from '@/lib/ai/parse-ai-json'
import { runCompletion, isAgentAvailable } from '@/lib/ai/run'
import { getCompanyContext } from '@/lib/company/context'
import { fetchDocumentContent } from '@/lib/tenderned/client'
import { extractTextFromBuffer } from '@/lib/documents/extract-text'
import { extractTextFromUploadedDoc, guessMimeFromFileName } from '@/lib/tenders/uploaded-document-text'

export const maxDuration = 60
export const runtime = 'nodejs'

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
    if (doc.tenderId !== id) {
      await db.update(tenderDocuments).set({ analysisStatus: 'pending' }).where(eq(tenderDocuments.id, docId))
      return NextResponse.json({ error: 'Document hoort niet bij deze tender' }, { status: 400 })
    }

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
      const fromUpload = await extractTextFromUploadedDoc(doc)
      if (fromUpload) {
        documentContext = fromUpload
      } else {
        documentContext = `Document naam: ${doc.fileName}\nType: ${doc.documentType}\nAanbesteding ID: ${id}\nGeen leesbare bestandsinhoud beschikbaar (upload opnieuw als PDF of DOCX, of controleer opslag). Analyseer voor zover mogelijk op basis van bestandsnaam en type.`
      }
    }

    let analysisJson: any = null
    let summary: string | null = null
    let analysisOk = false

    const companyContext = await getCompanyContext()

    try {
      const content = await runCompletion(
        'document_analysis',
        DOCUMENT_ANALYSIS_SYSTEM,
        DOCUMENT_ANALYSIS_USER(documentContext, companyContext || undefined),
        { jsonMode: true, maxTokens: 8192 }
      )
      analysisJson = parseAiJsonObject(content || '{}')
      summary = typeof analysisJson.summary === 'string' ? analysisJson.summary : ''
      analysisOk = true
    } catch (aiError) {
      console.warn('Document AI-analyse mislukt:', aiError)
    }

    const [updated] = await db.update(tenderDocuments)
      .set(
        analysisOk
          ? {
              analysisStatus: 'done',
              analysisSummary: summary,
              analysisJson,
            }
          : {
              analysisStatus: 'failed',
              analysisSummary: null,
              analysisJson: null,
            }
      )
      .where(eq(tenderDocuments.id, docId))
      .returning()

    await db.insert(tenderActivities).values({
      tenderId: id,
      userId,
      activityType: 'document_analyzed',
      description: analysisOk
        ? `Document geanalyseerd: ${doc.fileName}`
        : `Documentanalyse mislukt: ${doc.fileName}`,
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
