import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { companyDocuments } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

    const { docId } = await params
    await db.delete(companyDocuments).where(eq(companyDocuments.id, docId))
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete company document:', error)
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 })
  }
}
