import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { tenders, tenderActivities } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { gammaCreateGeneration, gammaGetGeneration } from '@/lib/gamma/client'
import { handoverPresentationHtmlToGammaInput } from '@/lib/gamma/handover-input'
import { displayTenderTitle } from '@/lib/tenders/resolve-project-title'

function visibleTextLength(html: string): number {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim().length
}

function getGammaApiKey(): string | null {
  const k = process.env.GAMMA_API_KEY?.trim()
  return k || null
}

/** Start een Gamma-generatie op basis van de bestaande handover-presentatie-HTML. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

    const apiKey = getGammaApiKey()
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gamma niet geconfigureerd. Zet GAMMA_API_KEY in de omgeving.' },
        { status: 503 }
      )
    }

    const { id } = await params
    const [tender] = await db.select().from(tenders).where(eq(tenders.id, id))
    if (!tender) return NextResponse.json({ error: 'Tender niet gevonden' }, { status: 404 })

    if (tender.status !== 'won') {
      return NextResponse.json(
        { error: 'Overdracht is alleen beschikbaar voor gewonnen tenders.' },
        { status: 400 }
      )
    }

    const html = tender.handoverPresentationHtml
    if (!html || visibleTextLength(html) < 50) {
      return NextResponse.json(
        {
          error:
            'Geen presentatie-inhoud. Genereer eerst een overdrachtsrapport (plan & presentatie) voordat je Gamma gebruikt.',
        },
        { status: 400 }
      )
    }

    const inputText = handoverPresentationHtmlToGammaInput(html, displayTenderTitle(tender.title))
    const { generationId, warnings } = await gammaCreateGeneration({ apiKey, inputText })

    const now = new Date()
    const [updated] = await db
      .update(tenders)
      .set({
        handoverGammaGenerationId: generationId,
        handoverGammaStatus: 'pending',
        handoverGammaUrl: null,
        handoverGammaExportUrl: null,
        handoverGammaError: null,
        updatedAt: now,
      })
      .where(eq(tenders.id, id))
      .returning()

    await db.insert(tenderActivities).values({
      tenderId: id,
      userId,
      activityType: 'tender_handover_gamma',
      description: 'Gamma-presentatie gestart (API)',
      metadata: warnings ? { warnings } : undefined,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Handover Gamma POST:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg || 'Gamma-start mislukt' }, { status: 500 })
  }
}

/** Haalt de Gamma-status op en werkt de tender bij bij voltooide export. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

    const apiKey = getGammaApiKey()
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gamma niet geconfigureerd. Zet GAMMA_API_KEY in de omgeving.' },
        { status: 503 }
      )
    }

    const { id } = await params
    const [tender] = await db.select().from(tenders).where(eq(tenders.id, id))
    if (!tender) return NextResponse.json({ error: 'Tender niet gevonden' }, { status: 404 })

    const genId = tender.handoverGammaGenerationId
    if (!genId) {
      return NextResponse.json({ error: 'Geen actieve Gamma-generatie voor deze tender.' }, { status: 400 })
    }

    if (tender.handoverGammaStatus === 'completed') {
      return NextResponse.json({
        tender,
        gamma: {
          status: 'completed' as const,
          generationId: genId,
          gammaUrl: tender.handoverGammaUrl ?? undefined,
          exportUrl: tender.handoverGammaExportUrl ?? undefined,
        },
      })
    }

    if (tender.handoverGammaStatus === 'failed' && tender.handoverGammaError) {
      return NextResponse.json({
        tender,
        gamma: {
          status: 'failed' as const,
          generationId: genId,
          error: tender.handoverGammaError,
        },
      })
    }

    const result = await gammaGetGeneration(apiKey, genId)
    const now = new Date()

    if (result.status === 'pending') {
      const [updated] = await db
        .update(tenders)
        .set({
          handoverGammaStatus: 'pending',
          updatedAt: now,
        })
        .where(eq(tenders.id, id))
        .returning()
      return NextResponse.json({
        tender: updated,
        gamma: { status: 'pending' as const, generationId: genId },
      })
    }

    if (result.status === 'failed') {
      const errMsg = result.error?.message || 'Gamma-generatie mislukt'
      const [updated] = await db
        .update(tenders)
        .set({
          handoverGammaStatus: 'failed',
          handoverGammaError: errMsg,
          updatedAt: now,
        })
        .where(eq(tenders.id, id))
        .returning()

      await db.insert(tenderActivities).values({
        tenderId: id,
        userId,
        activityType: 'tender_handover_gamma',
        description: `Gamma-presentatie mislukt: ${errMsg}`,
        metadata: { generationId: genId },
      })

      return NextResponse.json({
        tender: updated,
        gamma: { status: 'failed' as const, generationId: genId, error: errMsg },
      })
    }

    const [updated] = await db
      .update(tenders)
      .set({
        handoverGammaStatus: 'completed',
        handoverGammaUrl: result.gammaUrl ?? null,
        handoverGammaExportUrl: result.exportUrl ?? null,
        handoverGammaError: null,
        updatedAt: now,
      })
      .where(eq(tenders.id, id))
      .returning()

    await db.insert(tenderActivities).values({
      tenderId: id,
      userId,
      activityType: 'tender_handover_gamma',
      description: 'Gamma-presentatie gereed (export beschikbaar)',
      metadata: { generationId: genId, gammaUrl: result.gammaUrl },
    })

    return NextResponse.json({
      tender: updated,
      gamma: {
        status: 'completed' as const,
        generationId: genId,
        gammaUrl: result.gammaUrl,
        exportUrl: result.exportUrl,
      },
    })
  } catch (error) {
    console.error('Handover Gamma GET:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg || 'Gamma-status ophalen mislukt' }, { status: 500 })
  }
}
