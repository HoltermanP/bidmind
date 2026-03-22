import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { tenderSections, tenders } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { buildAanbiedingDocx } from '@/lib/documents/aanbieding-to-docx'
import { displayTenderTitle } from '@/lib/tenders/resolve-project-title'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const { id } = await params

  const [tender] = await db.select().from(tenders).where(eq(tenders.id, id))
  if (!tender) return NextResponse.json({ error: 'Tender not found' }, { status: 404 })

  const sections = await db
    .select()
    .from(tenderSections)
    .where(eq(tenderSections.tenderId, id))
    .orderBy(asc(tenderSections.orderIndex))

  const buffer = await buildAanbiedingDocx(
    {
      title: tender.title,
      contractingAuthority: tender.contractingAuthority,
      referenceNumber: tender.referenceNumber,
    },
    sections.map((s) => ({
      title: s.title,
      content: s.content,
      orderIndex: s.orderIndex,
    }))
  )

  const safeTitle = (displayTenderTitle(tender.title) || 'Aanbieding').replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').slice(0, 80)
  const filename = `Aanbieding_${safeTitle}.docx`

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
