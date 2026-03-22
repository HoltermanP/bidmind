import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { tenderDocuments, tenderQuestions } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'

/**
 * Verwijdert alle NVI-vragen voor deze tender en alle documenten met type Nota van Inlichtingen (NVI).
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

    const { id } = await params

    const deletedQuestions = await db
      .delete(tenderQuestions)
      .where(eq(tenderQuestions.tenderId, id))
      .returning({ id: tenderQuestions.id })

    const deletedDocuments = await db
      .delete(tenderDocuments)
      .where(
        and(eq(tenderDocuments.tenderId, id), eq(tenderDocuments.documentType, 'nota_van_inlichtingen'))
      )
      .returning({ id: tenderDocuments.id })

    return NextResponse.json({
      deletedQuestions: deletedQuestions.length,
      deletedDocuments: deletedDocuments.length,
    })
  } catch (error) {
    console.error('DELETE /api/tenders/[id]/nvi-clear error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
