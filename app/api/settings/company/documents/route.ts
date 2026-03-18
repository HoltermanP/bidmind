import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { companyDocuments } from '@/lib/db/schema'
import { extractTextFromBuffer } from '@/lib/documents/extract-text'

const ALLOWED_TYPES = ['vision', 'year_plan', 'other'] as const

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const documentType = (formData.get('documentType') as string) || 'other'

    if (!file) return NextResponse.json({ error: 'Geen bestand opgegeven' }, { status: 400 })
    if (!ALLOWED_TYPES.includes(documentType as any)) {
      return NextResponse.json({ error: 'Ongeldig documenttype. Gebruik: vision, year_plan of other' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const contentType = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    let extractedText: string | null = null
    try {
      extractedText = await extractTextFromBuffer(buffer, contentType)
    } catch {
      // niet verplicht; document wordt wel opgeslagen
    }

    const fileUrl = `https://placeholder.uploadthing.com/company/${Date.now()}_${file.name}`

    const [doc] = await db.insert(companyDocuments).values({
      documentType: documentType as 'vision' | 'year_plan' | 'other',
      fileName: file.name,
      fileUrl,
      fileSize: file.size,
      extractedText,
    }).returning()

    return NextResponse.json(doc, { status: 201 })
  } catch (error) {
    console.error('Company document upload:', error)
    return NextResponse.json({ error: 'Upload mislukt' }, { status: 500 })
  }
}
