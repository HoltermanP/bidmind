import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { lessonsLearned, tenders } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/tenders/[id]/lessons-learned — alle leerpunten voor deze tender.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

    const { id } = await params
    const [tender] = await db.select().from(tenders).where(eq(tenders.id, id))
    if (!tender) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const rows = await db
      .select()
      .from(lessonsLearned)
      .where(eq(lessonsLearned.tenderId, id))
      .orderBy(desc(lessonsLearned.createdAt))

    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET lessons-learned error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
