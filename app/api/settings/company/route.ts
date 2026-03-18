import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { companySettings, companyDocuments } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const SETTINGS_ID = 'default'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

    const [settings] = await db.select().from(companySettings).where(eq(companySettings.id, SETTINGS_ID))
    const documents = await db.select({
      id: companyDocuments.id,
      documentType: companyDocuments.documentType,
      fileName: companyDocuments.fileName,
      fileSize: companyDocuments.fileSize,
      uploadedAt: companyDocuments.uploadedAt,
    }).from(companyDocuments).orderBy(companyDocuments.uploadedAt)

    return NextResponse.json({
      settings: settings ?? {
        id: SETTINGS_ID,
        companyName: null,
        kvkNumber: null,
        tendernedNumber: null,
        defaultTenderManagerId: null,
        websiteUrl: null,
        description: null,
        visionText: null,
        annualPlanText: null,
        strengthsText: null,
        referencesText: null,
        updatedAt: null,
      },
      documents: documents ?? [],
    })
  } catch (error) {
    console.error('GET company settings:', error)
    return NextResponse.json({ error: 'Failed to load company settings' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

    const body = await request.json()
    const {
      companyName,
      kvkNumber,
      tendernedNumber,
      defaultTenderManagerId,
      websiteUrl,
      description,
      visionText,
      annualPlanText,
      strengthsText,
      referencesText,
    } = body

    const [existing] = await db.select().from(companySettings).where(eq(companySettings.id, SETTINGS_ID))

    const values = {
      companyName: companyName !== undefined ? companyName : existing?.companyName ?? null,
      kvkNumber: kvkNumber !== undefined ? kvkNumber : existing?.kvkNumber ?? null,
      tendernedNumber: tendernedNumber !== undefined ? tendernedNumber : existing?.tendernedNumber ?? null,
      defaultTenderManagerId: defaultTenderManagerId !== undefined ? defaultTenderManagerId || null : existing?.defaultTenderManagerId ?? null,
      websiteUrl: websiteUrl !== undefined ? websiteUrl : existing?.websiteUrl ?? null,
      description: description !== undefined ? description : existing?.description ?? null,
      visionText: visionText !== undefined ? visionText : existing?.visionText ?? null,
      annualPlanText: annualPlanText !== undefined ? annualPlanText : existing?.annualPlanText ?? null,
      strengthsText: strengthsText !== undefined ? strengthsText : existing?.strengthsText ?? null,
      referencesText: referencesText !== undefined ? referencesText : existing?.referencesText ?? null,
      updatedAt: new Date(),
    }

    if (existing) {
      await db.update(companySettings).set(values).where(eq(companySettings.id, SETTINGS_ID))
    } else {
      await db.insert(companySettings).values({ id: SETTINGS_ID, ...values })
    }

    const [updated] = await db.select().from(companySettings).where(eq(companySettings.id, SETTINGS_ID))
    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH company settings:', error)
    return NextResponse.json({ error: 'Failed to save company settings' }, { status: 500 })
  }
}
