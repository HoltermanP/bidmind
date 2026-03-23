import { after } from 'next/server'
import { db } from '@/lib/db'
import { tenders, tenderDocuments, tenderActivities } from '@/lib/db/schema'
import {
  fetchPublicatieDetail,
  fetchPublicatieDocumenten,
  documentDownloadUrl,
  parseContentIdFromHref,
} from '@/lib/tenderned/client'
import type { TenderNedDocument } from '@/lib/tenderned/types'
import { eq } from 'drizzle-orm'
import type { InferSelectModel } from 'drizzle-orm'
import { resolveProjectTitleFromTenderNed } from '@/lib/tenders/resolve-project-title'
import { reconcileIntakeSuitabilityForNewestLimit } from '@/lib/tenders/intake-suitability'
import { isSluitingsDatumExpired } from '@/lib/tenderned/sluitingsdatum'

export type TenderRow = InferSelectModel<typeof tenders>

type DocType =
  | 'aankondiging'
  | 'bestek'
  | 'leidraad'
  | 'tekening'
  | 'nota_van_inlichtingen'
  | 'eigen_upload'
  | 'concept_aanbieding'
  | 'definitief'

function mapTenderNedCategoryToDocumentType(doc: TenderNedDocument): DocType {
  const code = doc.publicatieCategorie?.code?.toUpperCase()
  if (code === 'ANK') return 'aankondiging'
  if (code === 'NVI') return 'nota_van_inlichtingen'
  if (code === 'DOC') return 'bestek'
  return 'eigen_upload'
}

export type ImportTenderNedPublicationOptions = {
  /** Geen `after(reconcileIntake…)`; gebruik bij batch-sync en roep intake-reconcile aan aan het eind. */
  deferIntakeReconcile?: boolean
  /** Standaard worden verlopen aankondigingen niet geïmporteerd. */
  allowExpired?: boolean
}

export type ImportTenderNedPublicationResult =
  | { kind: 'created'; tender: TenderRow }
  | { kind: 'existing'; tender: TenderRow }
  | { kind: 'expired'; publicatieId: string }

/**
 * Importeert één TenderNed-publicatie als tender + documenten.
 * Bij bestaande `tendernedPublicatieId` wordt de bestaande tender teruggegeven (`created: false`).
 * Verlopen (sluitingsdatum voorbij): `expired` tenzij `allowExpired`.
 */
export async function importTenderNedPublication(
  publicatieId: string,
  userId: string,
  options?: ImportTenderNedPublicationOptions
): Promise<ImportTenderNedPublicationResult> {
  if (!db) throw new Error('Database not configured')

  const [existing] = await db
    .select()
    .from(tenders)
    .where(eq(tenders.tendernedPublicatieId, publicatieId))
    .limit(1)
  if (existing) {
    return { kind: 'existing', tender: existing }
  }

  const detail = await fetchPublicatieDetail(publicatieId)

  if (!options?.allowExpired && isSluitingsDatumExpired(detail.sluitingsDatum)) {
    return { kind: 'expired', publicatieId }
  }

  const docList = await fetchPublicatieDocumenten(publicatieId)

  const tendernetUrl = `https://www.tenderned.nl/aankondigingen/overzicht/${publicatieId}`
  const publicationDate = detail.publicatieDatum ? new Date(detail.publicatieDatum) : null
  const deadlineSubmission = detail.sluitingsDatum ? new Date(detail.sluitingsDatum) : null
  const cpvCodes = Array.isArray(detail.cpvCodes) ? detail.cpvCodes.map((c) => c.code) : null

  const resolvedTitle = resolveProjectTitleFromTenderNed(
    detail.aanbestedingNaam ?? '',
    detail.opdrachtBeschrijving
  )

  const [tender] = await db
    .insert(tenders)
    .values({
      title: resolvedTitle,
      referenceNumber:
        detail.referentieNummer ?? (detail.kenmerk != null ? String(detail.kenmerk) : null),
      contractingAuthority: detail.opdrachtgeverNaam ?? null,
      publicationDate,
      deadlineSubmission,
      procedureType: detail.typePublicatie ?? null,
      cpvCodes,
      tendernetUrl,
      tendernedPublicatieId: publicatieId,
      tenderDescription: detail.opdrachtBeschrijving ?? null,
      tenderManagerId: userId,
      status: 'new',
      goNoGo: 'pending',
      winProbability: 0,
    })
    .returning()

  if (!tender) throw new Error('Tender aanmaken mislukt')

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

  if (!options?.deferIntakeReconcile) {
    after(() => {
      reconcileIntakeSuitabilityForNewestLimit().catch((err) => {
        console.error('reconcileIntakeSuitabilityForNewestLimit na import:', err)
      })
    })
  }

  const [refreshed] = await db.select().from(tenders).where(eq(tenders.id, tender.id)).limit(1)

  return { kind: 'created', tender: refreshed ?? tender }
}
