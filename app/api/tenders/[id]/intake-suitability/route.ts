import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { tenders } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { runIntakeSuitabilityForTenderId } from '@/lib/tenders/intake-suitability'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/tenders/[id]/intake-suitability
 * Herberekent geschiktheid (intake-agent) op basis van bedrijfsinformatie en tendergegevens.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

    const { id } = await params
    const [existing] = await db.select().from(tenders).where(eq(tenders.id, id))
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await runIntakeSuitabilityForTenderId(id)

    const [updated] = await db.select().from(tenders).where(eq(tenders.id, id))
    return NextResponse.json(updated)
  } catch (error) {
    console.error('POST intake-suitability error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
