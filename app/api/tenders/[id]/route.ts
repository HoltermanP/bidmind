import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { tenders, tenderActivities } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!db) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { id } = await params
    const [tender] = await db.select().from(tenders).where(eq(tenders.id, id))
    if (!tender) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(tender)
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

    const { id } = await params
    const body = await request.json()

    const allowedFields = [
      'title', 'referenceNumber', 'contractingAuthority', 'procedureType',
      'estimatedValue', 'deadlineQuestions', 'deadlineSubmission', 'tendernetUrl',
      'status', 'goNoGo', 'winProbability', 'tenderManagerId', 'teamMemberIds',
      'goNoGoReasoning', 'cpvCodes', 'publicationDate',
    ]

    const updates: Record<string, any> = {}
    for (const key of allowedFields) {
      if (key in body) {
        if ((key === 'deadlineQuestions' || key === 'deadlineSubmission' || key === 'publicationDate') && body[key]) {
          updates[key] = new Date(body[key])
        } else {
          updates[key] = body[key]
        }
      }
    }

    updates.updatedAt = new Date()

    const [updated] = await db.update(tenders).set(updates).where(eq(tenders.id, id)).returning()

    // Log status changes
    if ('status' in body) {
      await db.insert(tenderActivities).values({
        tenderId: id,
        userId,
        activityType: 'status_changed',
        description: `Status gewijzigd naar ${body.status}`,
        metadata: { status: body.status },
      })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/tenders/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

    const { id } = await params
    const [existing] = await db.select().from(tenders).where(eq(tenders.id, id))
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Verwijder tender; door ON DELETE CASCADE worden automatisch verwijderd:
    // tender_activities, tender_documents, tender_notes, tender_questions, tender_sections
    await db.delete(tenders).where(eq(tenders.id, id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/tenders/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
