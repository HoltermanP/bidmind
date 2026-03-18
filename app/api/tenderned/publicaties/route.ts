import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { fetchPublicaties, mapPublicatieToTender } from '@/lib/tenderned/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_ALL_ITEMS = 2000
const PAGE_SIZE = 50

/**
 * GET /api/tenderned/publicaties
 * Haalt aankondigingen/aanbestedingen op van TenderNed (open data TNS v2).
 * Alleen voor ingelogde gebruikers.
 * Query: page (default 0), size (default 20). Of all=true om alle pagina's op te halen (max MAX_ALL_ITEMS).
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const fetchAll = searchParams.get('all') === 'true'

    if (fetchAll) {
      const allContent: Awaited<ReturnType<typeof mapPublicatieToTender>>[] = []
      let page = 0
      let totalElements = 0
      let totalPages = 1
      while (true) {
        const data = await fetchPublicaties({ page, size: PAGE_SIZE })
        const mapped = data.content.map(mapPublicatieToTender)
        allContent.push(...mapped)
        totalElements = data.totalElements
        totalPages = data.totalPages
        if (data.last || allContent.length >= totalElements || allContent.length >= MAX_ALL_ITEMS) break
        page += 1
      }
      const capped = allContent.slice(0, MAX_ALL_ITEMS)
      return NextResponse.json({
        content: capped,
        first: true,
        last: true,
        totalElements: capped.length,
        totalPages: 1,
        size: capped.length,
        numberOfElements: capped.length,
        number: 0,
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
