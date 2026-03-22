import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { tenderDocuments, tenderActivities } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

/** Wis opgeslagen documentanalyse (incl. risico’s); bestand blijft staan. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

    const { id, docId } = await params
    const body = await request.json().catch(() => ({}))
    if (body.clearAnalysis !== true) {
      return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 })
    }

    const [doc] = await db.select().from(tenderDocuments).where(eq(tenderDocuments.id, docId))
    if (!doc) return NextResponse.json({ error: 'Document niet gevonden' }, { status: 404 })
    if (doc.tenderId !== id) return NextResponse.json({ error: 'Document hoort niet bij deze tender' }, { status: 400 })
    if (doc.analysisStatus === 'processing') {
      return NextResponse.json({ error: 'Analyse is nog bezig; even wachten.' }, { status: 409 })
    }

    const [updated] = await db
      .update(tenderDocuments)
      .set({
        analysisStatus: 'pending',
        analysisSummary: null,
        analysisJson: null,
      })
      .where(eq(tenderDocuments.id, docId))
      .returning()

    await db.insert(tenderActivities).values({
      tenderId: id,
      userId,
      activityType: 'document_analysis_cleared',
      description: `Documentanalyse gewist: ${doc.fileName ?? docId}`,
      metadata: { docId },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/tenders/[id]/documents/[docId] error:', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

    const { docId } = await params
    await db.delete(tenderDocuments).where(eq(tenderDocuments.id, docId))

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
