import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { db } from '@/lib/db'
import { tenderDocuments, tenderActivities } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

    const { id } = await params
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const [doc] = await db
      .insert(tenderDocuments)
      .values({
        tenderId: id,
        fileName: file.name,
        fileUrl: '',
        fileSize: file.size,
        documentType: 'eigen_upload',
        analysisStatus: 'pending',
        uploadedBy: userId,
      })
      .returning()

    const ext = path.extname(file.name) || '.bin'
    const relativeUrl = `/uploads/tenders/${id}/${doc.id}${ext}`
    const absDir = path.join(process.cwd(), 'public', 'uploads', 'tenders', id)
    const absFile = path.join(absDir, `${doc.id}${ext}`)

    await mkdir(absDir, { recursive: true })
    const buf = Buffer.from(await file.arrayBuffer())
    await writeFile(absFile, buf)

    const resolvedFile = path.resolve(absFile)
    const allowedRoot = path.resolve(process.cwd(), 'public', 'uploads', 'tenders', id)
    if (!resolvedFile.startsWith(allowedRoot)) {
      await db.delete(tenderDocuments).where(eq(tenderDocuments.id, doc.id))
      return NextResponse.json({ error: 'Ongeldig pad' }, { status: 400 })
    }

    const [updated] = await db
      .update(tenderDocuments)
      .set({
        fileUrl: relativeUrl,
        fileSize: buf.length,
      })
      .where(eq(tenderDocuments.id, doc.id))
      .returning()

    await db.insert(tenderActivities).values({
      tenderId: id,
      userId,
      activityType: 'document_uploaded',
      description: `Document geüpload: ${file.name}`,
      metadata: { fileName: file.name, docId: updated!.id },
    })

    return NextResponse.json(updated, { status: 201 })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
