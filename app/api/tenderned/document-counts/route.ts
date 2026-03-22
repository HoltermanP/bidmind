import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { fetchPublicatieDocumenten } from '@/lib/tenderned/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_IDS = 40

/**
 * POST /api/tenderned/document-counts
 * Body: { publicatieIds: string[] }
 * Retourneert het aantal documenten per publicatie (TenderNed TNS v2).
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
      return NextResponse.json({ counts: {} as Record<string, number | null> })
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
    return NextResponse.json({ counts })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Documentaantallen ophalen mislukt'
    console.error('POST /api/tenderned/document-counts error:', message, error)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
