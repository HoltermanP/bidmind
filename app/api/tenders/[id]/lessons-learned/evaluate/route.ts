import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { tenders } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { evaluateLessonsFromDocument } from '@/lib/tenders/lessons-learned-eval'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * POST /api/tenders/[id]/lessons-learned/evaluate
 * Body: { documentId: string } — tekst uit dat document → Evaluatie Agent → rijen in lessons_learned.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

    const { id } = await params
    const [tender] = await db.select().from(tenders).where(eq(tenders.id, id))
    if (!tender) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const documentId = typeof body.documentId === 'string' ? body.documentId : ''
    if (!documentId) {
      return NextResponse.json({ error: 'documentId is verplicht' }, { status: 400 })
    }

    const result = await evaluateLessonsFromDocument({
      tenderId: id,
      documentId,
      userId,
    })

    return NextResponse.json(result)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error'
    let status = 500
    if (msg.includes('niet gevonden')) status = 404
    else if (msg.includes('Geen leesbare')) status = 400
    else if (msg.includes('niet geconfigureerd')) status = 503
    console.error('POST lessons-learned/evaluate error:', error)
    return NextResponse.json({ error: msg }, { status })
  }
}
