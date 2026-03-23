import { NextRequest, NextResponse, after } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { tenders } from '@/lib/db/schema'
import { fetchPublicaties } from '@/lib/tenderned/client'
import { importTenderNedPublication } from '@/lib/tenderned/import-publication'
import { isTenderNedPublicationExpiredOnList } from '@/lib/tenderned/sluitingsdatum'
import { isNotNull } from 'drizzle-orm'
import { reconcileIntakeSuitabilityForNewestLimit } from '@/lib/tenders/intake-suitability'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const LIST_PAGE_SIZE = 50
/** Eerste keer synchroniseren (geen enkele tender met TenderNed-publicatie-id): maximaal dit aantal nieuwe tenders. */
const FIRST_IMPORT_MAX = 100
const MAX_PAGES = 4000

export type TenderNedSyncReason =
  | 'reached_known'
  | 'cap_100'
  | 'last_page'
  | 'empty_page'
  | 'page_limit'

/**
 * POST /api/tenderned/sync
 * Body: (leeg)
 *
 * TenderNed levert nieuwste publicaties eerst.
 * - Geen enkele tender met `tenderned_publicatie_id`: importeer max. {@link FIRST_IMPORT_MAX} niet-verlopen nieuwe tenders.
 * - Anders: importeer alleen publicaties **boven** wat al in de database staat; stop bij de eerste bekende `publicatieId`.
 * Verlopen aankondigingen worden overgeslagen.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

    try {
      await request.json()
    } catch {
      /* lege body */
    }

    const idRows = await db
      .select({ pid: tenders.tendernedPublicatieId })
      .from(tenders)
      .where(isNotNull(tenders.tendernedPublicatieId))
    const existing = new Set(idRows.map((r) => r.pid!).filter(Boolean))

    const isInitialImport = existing.size === 0
    let imported = 0
    let reason: TenderNedSyncReason = 'last_page'

    const done = (r: TenderNedSyncReason, tenderNedTotalElements: number | null) => {
      reason = r
      after(() => {
        reconcileIntakeSuitabilityForNewestLimit().catch((err) => {
          console.error('reconcileIntakeSuitabilityForNewestLimit na sync:', err)
        })
      })
      return NextResponse.json({
        imported,
        complete: true,
        mode: isInitialImport ? 'initial' : 'incremental',
        reason,
        tenderNedTotalElements,
      })
    }

    let lastTotalElements: number | null = null

    for (let currentPage = 0; currentPage < MAX_PAGES; currentPage++) {
      const data = await fetchPublicaties({ page: currentPage, size: LIST_PAGE_SIZE })
      lastTotalElements = typeof data.totalElements === 'number' ? data.totalElements : lastTotalElements
      const content = data.content ?? []

      if (content.length === 0) {
        return done('empty_page', lastTotalElements)
      }

      for (const row of content) {
        const pid = String(row.publicatieId)

        if (existing.has(pid)) {
          return done('reached_known', lastTotalElements)
        }

        if (isTenderNedPublicationExpiredOnList(row)) continue

        const result = await importTenderNedPublication(pid, userId, {
          deferIntakeReconcile: true,
        })
        if (result.kind === 'expired') continue
        if (result.kind === 'created') {
          existing.add(pid)
          imported++
        }

        if (isInitialImport && imported >= FIRST_IMPORT_MAX) {
          return done('cap_100', lastTotalElements)
        }
      }

      if (data.last) {
        return done('last_page', lastTotalElements)
      }
    }

    return done('page_limit', lastTotalElements)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Synchronisatie mislukt'
    console.error('POST /api/tenderned/sync error:', message, error)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
