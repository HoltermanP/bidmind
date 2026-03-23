import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { fetchPublicatieDocumenten } from '@/lib/tenderned/client'
import { db } from '@/lib/db'
import { tenders } from '@/lib/db/schema'
import { and, desc, inArray, isNotNull } from 'drizzle-orm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_IDS = 40

/**
 * POST /api/tenderned/document-counts
 * Body: { publicatieIds: string[] }
 * Retourneert het aantal documenten per publicatie (TenderNed TNS v2).
 * Optioneel veld `intake`: per publicatie-id de intake-geschiktheid van een reeds geïmporteerde tender (zelfde ids).
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const raw = body?.publicatieIds
    if (!Array.isArray(raw)) {
      return NextResponse.json({ error: 'publicatieIds moet een array zijn' }, { status: 400 })
    }

    const ids = raw
      .map((id: unknown) => (id != null ? String(id).trim() : ''))
      .filter(Boolean)
      .slice(0, MAX_IDS)

    if (ids.length === 0) {
      return NextResponse.json({ counts: {} as Record<string, number | null>, intake: {} })
    }

    const results = await Promise.all(
      ids.map(async (publicatieId) => {
        try {
          const data = await fetchPublicatieDocumenten(publicatieId)
          return [publicatieId, data.documenten.length] as const
        } catch {
          return [publicatieId, null] as const
        }
      })
    )

    const counts = Object.fromEntries(results) as Record<string, number | null>

    const intakeRows = db
      ? await db
          .select({
            tendernedPublicatieId: tenders.tendernedPublicatieId,
            tenderId: tenders.id,
            intakeSuitabilityStatus: tenders.intakeSuitabilityStatus,
            intakeSuitabilityScore: tenders.intakeSuitabilityScore,
            intakeSuitabilityTier: tenders.intakeSuitabilityTier,
          })
          .from(tenders)
          .where(and(isNotNull(tenders.tendernedPublicatieId), inArray(tenders.tendernedPublicatieId, ids)))
          .orderBy(desc(tenders.updatedAt))
      : []

    const intakeByPublicatieId: Record<
      string,
      {
        tenderId: string
        intakeSuitabilityStatus: string | null
        intakeSuitabilityScore: number | null
        intakeSuitabilityTier: string | null
      }
    > = {}
    for (const row of intakeRows) {
      const pid = row.tendernedPublicatieId
      if (!pid || intakeByPublicatieId[pid]) continue
      intakeByPublicatieId[pid] = {
        tenderId: row.tenderId,
        intakeSuitabilityStatus: row.intakeSuitabilityStatus,
        intakeSuitabilityScore: row.intakeSuitabilityScore,
        intakeSuitabilityTier: row.intakeSuitabilityTier,
      }
    }

    const intake: Record<string, (typeof intakeByPublicatieId)[string] | null> = {}
    for (const id of ids) {
      intake[id] = intakeByPublicatieId[id] ?? null
    }

    return NextResponse.json({ counts, intake })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Documentaantallen ophalen mislukt'
    console.error('POST /api/tenderned/document-counts error:', message, error)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
