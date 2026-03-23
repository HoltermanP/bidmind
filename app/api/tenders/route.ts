import { NextRequest, NextResponse, after } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { tenders } from '@/lib/db/schema'
import { desc, ilike, or, eq, and, inArray, gte } from 'drizzle-orm'
import { reconcileIntakeSuitabilityForNewestLimit } from '@/lib/tenders/intake-suitability'

export const maxDuration = 120

/** Minimale intake-score voor filter `geschiktheid=minscore70` (afgestemd op sterke matches). */
const INTAKE_SCORE_HIGH_MIN = 70

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!db) return NextResponse.json([])

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')
    const status = searchParams.get('status')
    const goNoGo = searchParams.get('gonogo')
    const geschiktheid = searchParams.get('geschiktheid')

    let query = db.select().from(tenders).$dynamic()

    const conditions = []

    if (q) {
      conditions.push(
        or(
          ilike(tenders.title, `%${q}%`),
          ilike(tenders.referenceNumber, `%${q}%`),
          ilike(tenders.contractingAuthority, `%${q}%`)
        )
      )
    }

    if (status && status !== 'all') {
      conditions.push(eq(tenders.status, status as any))
    }

    if (goNoGo && goNoGo !== 'all') {
      conditions.push(eq(tenders.goNoGo, goNoGo as any))
    }

    if (geschiktheid && geschiktheid !== 'all') {
      if (geschiktheid === 'none') {
        conditions.push(inArray(tenders.intakeSuitabilityStatus, ['pending', 'processing', 'failed']))
      } else if (geschiktheid === 'low' || geschiktheid === 'medium' || geschiktheid === 'high') {
        conditions.push(eq(tenders.intakeSuitabilityTier, geschiktheid))
      } else if (geschiktheid === 'minscore70') {
        conditions.push(eq(tenders.intakeSuitabilityStatus, 'done'))
        conditions.push(gte(tenders.intakeSuitabilityScore, INTAKE_SCORE_HIGH_MIN))
      }
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions))
    }

    const result = await query.orderBy(desc(tenders.updatedAt))
    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/tenders error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

    const body = await request.json()

    const [tender] = await db.insert(tenders).values({
      title: body.title,
      referenceNumber: body.referenceNumber || null,
      contractingAuthority: body.contractingAuthority || null,
      procedureType: body.procedureType || null,
      estimatedValue: body.estimatedValue?.toString() || null,
      deadlineQuestions: body.deadlineQuestions ? new Date(body.deadlineQuestions) : null,
      deadlineSubmission: body.deadlineSubmission ? new Date(body.deadlineSubmission) : null,
      tendernetUrl: body.tendernetUrl || null,
      tenderManagerId: userId,
      status: 'new',
      goNoGo: 'pending',
      winProbability: 0,
    }).returning()

    after(() => {
      reconcileIntakeSuitabilityForNewestLimit().catch((err) => {
        console.error('reconcileIntakeSuitabilityForNewestLimit na tender aanmaken:', err)
      })
    })

    return NextResponse.json(tender, { status: 201 })
  } catch (error) {
    console.error('POST /api/tenders error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
