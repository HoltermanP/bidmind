import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { importTenderNedPublication } from '@/lib/tenderned/import-publication'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/** Import + documenten; geschiktheid loopt daarna in `after()` (kan meerdere LLM-calls doen). */
export const maxDuration = 120

/**
 * POST /api/tenderned/import
 * Body: { publicatieId: string, allowExpired?: boolean }
 * Haalt volledige publicatie-informatie en alle documenten van TenderNed op en slaat ze lokaal op.
 * Bestaande tender met dezelfde publicatie-id: 200 + alreadyExisted.
 * Verlopen sluitingsdatum: 400, tenzij allowExpired true.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

    const body = await request.json()
    const publicatieId = body.publicatieId != null ? String(body.publicatieId) : null
    if (!publicatieId) return NextResponse.json({ error: 'publicatieId is verplicht' }, { status: 400 })
    const allowExpired = body.allowExpired === true

    const result = await importTenderNedPublication(publicatieId, userId, { allowExpired })

    if (result.kind === 'expired') {
      return NextResponse.json(
        {
          error: 'Deze aankondiging is verlopen (sluitingsdatum ligt in het verleden).',
          code: 'expired',
        },
        { status: 400 }
      )
    }

    if (result.kind === 'existing') {
      return NextResponse.json({ ...result.tender, alreadyExisted: true }, { status: 200 })
    }

    return NextResponse.json(result.tender, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Import mislukt'
    console.error('POST /api/tenderned/import error:', message, error)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
