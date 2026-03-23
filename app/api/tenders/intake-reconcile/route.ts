import { NextResponse, after } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { reconcileIntakeSuitabilityForNewestLimit } from '@/lib/tenders/intake-suitability'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * POST /api/tenders/intake-reconcile
 * Plant af: geschiktheid gelijk trekken met de 20 nieuwste tenders (wissen buiten top 20, ontbrekende scores invullen).
 * Antwoordt direct; het werk draait via `after()` op de server.
 */
export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  after(() => {
    reconcileIntakeSuitabilityForNewestLimit().catch((err) => {
      console.error('reconcileIntakeSuitabilityForNewestLimit (intake-reconcile):', err)
    })
  })

  return NextResponse.json({ ok: true, message: 'Intake-synchronisatie gestart' }, { status: 202 })
}
