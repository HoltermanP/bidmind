import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { fetchPublicaties, mapPublicatieToTender } from '@/lib/tenderned/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_MAX_ITEMS = 100
const MAX_ITEMS_CAP = 200
const MAX_ITEMS_PAGES = 25

/**
 * GET /api/tenderned/publicaties
 * Haalt aankondigingen/aanbestedingen op van TenderNed (open data TNS v2).
 * Alleen voor ingelogde gebruikers.
 * Query: page (default 0), size (1–50, default 20).
 * Of: maxItems (1–200, default 100) — nieuwste eerst, meerdere TenderNed-pagina’s achter elkaar in één response.
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const maxItemsRaw = searchParams.get('maxItems')

    if (maxItemsRaw != null) {
      const maxItems = Math.min(
        MAX_ITEMS_CAP,
        Math.max(1, parseInt(maxItemsRaw, 10) || DEFAULT_MAX_ITEMS)
      )
      const pageSize = 50
      const merged: ReturnType<typeof mapPublicatieToTender>[] = []
      let lastTotalElements = 0
      let lastTotalPages = 1

      for (let p = 0; p < MAX_ITEMS_PAGES && merged.length < maxItems; p++) {
        const data = await fetchPublicaties({ page: p, size: pageSize })
        lastTotalElements = data.totalElements
        lastTotalPages = data.totalPages
        const mapped = data.content.map(mapPublicatieToTender)
        for (const item of mapped) {
          merged.push(item)
          if (merged.length >= maxItems) break
        }
        if (data.last || data.content.length < pageSize) break
      }

      const slice = merged.slice(0, maxItems)
      return NextResponse.json({
        content: slice,
        first: true,
        last: true,
        totalElements: lastTotalElements,
        totalPages: lastTotalPages,
        size: slice.length,
        numberOfElements: slice.length,
        number: 0,
        maxItems,
      })
    }

    const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10))
    const size = Math.min(50, Math.max(1, parseInt(searchParams.get('size') ?? '20', 10)))

    const data = await fetchPublicaties({ page, size })
    const mapped = data.content.map(mapPublicatieToTender)

    return NextResponse.json({
      content: mapped,
      first: data.first,
      last: data.last,
      totalElements: data.totalElements,
      totalPages: data.totalPages,
      size: data.size,
      numberOfElements: data.numberOfElements,
      number: data.number,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TenderNed ophalen mislukt'
    const detail = error instanceof Error ? error.stack : String(error)
    console.error('GET /api/tenderned/publicaties error:', message, detail)
    return NextResponse.json(
      { error: message },
      { status: 502 }
    )
  }
}
