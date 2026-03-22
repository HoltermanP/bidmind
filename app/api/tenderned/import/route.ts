import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { tenders, tenderDocuments, tenderActivities } from '@/lib/db/schema'
import {
  fetchPublicatieDetail,
  fetchPublicatieDocumenten,
  documentDownloadUrl,
  parseContentIdFromHref,
} from '@/lib/tenderned/client'
import type { TenderNedDocument } from '@/lib/tenderned/types'
import { resolveProjectTitleFromTenderNed } from '@/lib/tenders/resolve-project-title'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type DocType = 'aankondiging' | 'bestek' | 'leidraad' | 'tekening' | 'nota_van_inlichtingen' | 'eigen_upload' | 'concept_aanbieding' | 'definitief'

function mapTenderNedCategoryToDocumentType(doc: TenderNedDocument): DocType {
  const code = doc.publicatieCategorie?.code?.toUpperCase()
  if (code === 'ANK') return 'aankondiging'
  if (code === 'NVI') return 'nota_van_inlichtingen'
  if (code === 'DOC') return 'bestek'
  return 'eigen_upload'
}

/**
 * POST /api/tenderned/import
 * Body: { publicatieId: string }
 * Haalt volledige publicatie-informatie en alle documenten van TenderNed op en slaat ze lokaal op.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

    const body = await request.json()
    const publicatieId = body.publicatieId != null ? String(body.publicatieId) : null
    if (!publicatieId) return NextResponse.json({ error: 'publicatieId is verplicht' }, { status: 400 })

    const [detail, docList] = await Promise.all([
      fetchPublicatieDetail(publicatieId),
      fetchPublicatieDocumenten(publicatieId),
    ])

    const tendernetUrl = `https://www.tenderned.nl/aankondigingen/overzicht/${publicatieId}`
    const publicationDate = detail.publicatieDatum ? new Date(detail.publicatieDatum) : null
    const deadlineSubmission = detail.sluitingsDatum ? new Date(detail.sluitingsDatum) : null
    const cpvCodes = Array.isArray(detail.cpvCodes)
      ? detail.cpvCodes.map((c) => c.code)
      : null

    const resolvedTitle = resolveProjectTitleFromTenderNed(
      detail.aanbestedingNaam ?? '',
      detail.opdrachtBeschrijving
    )

    const [tender] = await db.insert(tenders).values({
      title: resolvedTitle,
      referenceNumber: detail.referentieNummer ?? (detail.kenmerk != null ? String(detail.kenmerk) : null),
      contractingAuthority: detail.opdrachtgeverNaam ?? null,
      publicationDate,
      deadlineSubmission,
      procedureType: detail.typePublicatie ?? null,
      cpvCodes,
      tendernetUrl,
      tendernedPublicatieId: publicatieId,
      tenderManagerId: userId,
      status: 'new',
      goNoGo: 'pending',
      winProbability: 0,
    }).returning()

    if (!tender) return NextResponse.json({ error: 'Tender aanmaken mislukt' }, { status: 500 })

    const documenten = docList.documenten ?? []
    if (documenten.length > 0) {
      const rows = documenten.map((doc) => {
        const href = doc.links?.download?.href ?? ''
        const fileUrl = documentDownloadUrl(href)
        const contentId = parseContentIdFromHref(href)
        const docType = mapTenderNedCategoryToDocumentType(doc)
        const fileName = doc.documentNaam ?? 'document'
        const ext = doc.typeDocument?.code === 'docx' ? '.docx' : '.pdf'
        const fileNameWithExt = fileName.includes('.') ? fileName : `${fileName}${ext}`
        return {
          tenderId: tender.id,
          fileName: fileNameWithExt,
          fileUrl: fileUrl || null,
          fileSize: doc.grootte ?? null,
          documentType: docType,
          analysisStatus: 'pending' as const,
          uploadedBy: userId,
          tendernedContentId: contentId,
        }
      })
      await db.insert(tenderDocuments).values(rows)
    }

    await db.insert(tenderActivities).values({
      tenderId: tender.id,
      userId,
      activityType: 'tender_imported',
      description: `Tender geïmporteerd van TenderNed (publicatie ${publicatieId}, ${documenten.length} documenten)`,
      metadata: { publicatieId, documentCount: documenten.length },
    })

    return NextResponse.json(tender, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Import mislukt'
    console.error('POST /api/tenderned/import error:', message, error)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
