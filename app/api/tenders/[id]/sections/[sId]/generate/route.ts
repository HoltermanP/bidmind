import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { tenderSections, tenders, tenderDocuments } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { SECTION_WRITING_SYSTEM, SECTION_WRITING_USER } from '@/lib/ai/prompts'
import { runCompletionStream, isAgentAvailable } from '@/lib/ai/run'
import { getCompanyContext } from '@/lib/company/context'
import { buildLessonsLearnedContextForWriting } from '@/lib/tenders/lessons-learned-eval'

const SECTION_TYPE_LABELS: Record<string, string> = {
  plan_van_aanpak: 'Plan van Aanpak',
  kwaliteit: 'Kwaliteitsborging',
  prijs_onderbouwing: 'Prijsonderbouwing',
  team_cv: "Team & CV's",
  referenties: 'Referenties',
  vca_veiligheid: 'VCA & Veiligheid',
  eigen_sectie: 'Eigen sectie',
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sId: string }> }
) {
  const { userId } = await auth()
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }
  if (!db) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), { status: 503 })
  }
  if (!isAgentAvailable('section_writing')) {
    return new Response(
      JSON.stringify({ error: 'AI-provider voor sectie-generatie niet geconfigureerd (ANTHROPIC_API_KEY)' }),
      { status: 503 }
    )
  }

  const { id, sId } = await params
  const body = await request.json()

  const [tender] = await db.select().from(tenders).where(eq(tenders.id, id))
  const [section] = await db.select().from(tenderSections).where(eq(tenderSections.id, sId))
  const documents = await db.select().from(tenderDocuments).where(eq(tenderDocuments.tenderId, id))

  const requirements = documents
    .flatMap((d) => (d.analysisJson as any)?.key_requirements || [])
    .filter(Boolean)

  const documentContextParts = documents.map((d) => {
    const j = d.analysisJson as any
    const lines: string[] = [
      `Document: ${d.fileName}`,
      `Samenvatting: ${d.analysisSummary || j?.summary || 'Geen samenvatting.'}`,
    ]
    if (j?.key_requirements?.length) lines.push(`Eisen: ${(j.key_requirements as string[]).join(' | ')}`)
    if (j?.award_criteria?.length) {
      lines.push(`Gunningscriteria: ${(j.award_criteria as { criterion?: string; weight?: string }[]).map((c: any) => `${c.criterion || c} (${c.weight || '-'})`).join(' | ')}`)
    }
    if (j?.risks?.length) lines.push(`Risico's: ${(j.risks as string[]).join(' | ')}`)
    return lines.join('\n')
  })
  const documentContext = documentContextParts.length
    ? documentContextParts.join('\n\n---\n\n')
    : 'Geen geanalyseerde documenten beschikbaar. Schrijf een professionele, inhoudelijk sterke sectie passend bij het sectietype en de tender.'

  const sectionTypeLabel = SECTION_TYPE_LABELS[section?.sectionType || 'eigen_sectie'] || (body.sectionType || 'sectie')
  const companyContext = await getCompanyContext()
  const lessonsLearnedContext = await buildLessonsLearnedContextForWriting(35)

  const userContent = SECTION_WRITING_USER(
    sectionTypeLabel,
    tender?.title || 'Onbekende tender',
    tender?.contractingAuthority || 'Onbekende aanbesteder',
    requirements.length ? requirements : ['Conform de eisen van de aanbestedende dienst.'],
    documentContext,
    companyContext || undefined,
    lessonsLearnedContext || undefined,
  )

  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = runCompletionStream(
          'section_writing',
          SECTION_WRITING_SYSTEM,
          userContent
        )
        for await (const chunk of stream) {
          controller.enqueue(encoder.encode(`data: ${chunk}\n\n`))
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (err) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`))
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
