import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { tenderQuestions, tenderDocuments, tenders } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { QUESTION_GENERATION_SYSTEM, QUESTION_GENERATION_USER } from '@/lib/ai/prompts'
import { runCompletion, isAgentAvailable } from '@/lib/ai/run'
import { getCompanyContext } from '@/lib/company/context'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
    if (!isAgentAvailable('question_generation')) {
      // Geen API key: gebruik direct de mockvragen
      const { id } = await params
      const generatedQuestions = [
        { question_text: 'Wat zijn de exacte toleranties voor trillingsbelasting tijdens de uitvoering?', rationale: 'Cruciaal voor planning en risicobeheersing', category: 'Technisch', priority: 'critical' },
        { question_text: 'Is er ruimte voor een gefaseerde aanpak van de werkzaamheden?', rationale: 'Kan de overlast voor omgeving beperken', category: 'Planning', priority: 'high' },
        { question_text: 'Hoe wordt de bodemkwaliteit vastgesteld voor aanvang?', rationale: 'Onbekende bodemgesteldheid vormt financieel risico', category: 'Technisch', priority: 'high' },
        { question_text: 'Zijn er aanvullende eisen voor omgevingsmanagement?', rationale: 'Impact op omgeving kan leiden tot extra kosten', category: 'Contractueel', priority: 'medium' },
      ]
      const inserted = await db.insert(tenderQuestions).values(
        generatedQuestions.map((q: any) => ({
          tenderId: id,
          questionText: q.question_text || q.questionText,
          rationale: q.rationale || null,
          category: q.category || 'Overig',
          priority: (q.priority as any) || 'medium',
          status: 'draft' as const,
          aiGenerated: true,
          createdBy: userId,
        }))
      ).returning()
      return NextResponse.json(inserted)
    }

    const { id } = await params

    const [tender] = await db.select().from(tenders).where(eq(tenders.id, id))
    const documents = await db.select().from(tenderDocuments).where(eq(tenderDocuments.tenderId, id))

    const summaries = documents
      .filter((d) => d.analysisSummary || d.analysisJson)
      .map((d) => `Document: ${d.fileName}\nSamenvatting: ${d.analysisSummary || ''}\nEisen: ${JSON.stringify((d.analysisJson as any)?.key_requirements || [])}`)
      .join('\n\n---\n\n')

    const context = summaries || `Tender: ${tender?.title}\nAanbesteder: ${tender?.contractingAuthority}\nProcedure: ${tender?.procedureType}`
    const companyContext = await getCompanyContext()

    let generatedQuestions: any[] = []

    try {
      const content = await runCompletion(
        'question_generation',
        QUESTION_GENERATION_SYSTEM,
        QUESTION_GENERATION_USER(context, companyContext || undefined),
        { jsonMode: true }
      )
      const parsed = JSON.parse(content || '{"questions":[]}')
      generatedQuestions = Array.isArray(parsed) ? parsed : (parsed.questions || [])
    } catch (aiError) {
      // Fallback mock questions
      generatedQuestions = [
        {
          question_text: 'Wat zijn de exacte toleranties voor trillingsbelasting tijdens de uitvoering?',
          rationale: 'Cruciaal voor planning en risicobeheersing',
          category: 'Technisch',
          priority: 'critical',
        },
        {
          question_text: 'Is er ruimte voor een gefaseerde aanpak van de werkzaamheden?',
          rationale: 'Kan de overlast voor omgeving beperken',
          category: 'Planning',
          priority: 'high',
        },
        {
          question_text: 'Hoe wordt de bodemkwaliteit vastgesteld voor aanvang?',
          rationale: 'Onbekende bodemgesteldheid vormt financieel risico',
          category: 'Technisch',
          priority: 'high',
        },
        {
          question_text: 'Zijn er aanvullende eisen voor omgevingsmanagement?',
          rationale: 'Impact op omgeving kan leiden tot extra kosten',
          category: 'Contractueel',
          priority: 'medium',
        },
      ]
    }

    const inserted = await db.insert(tenderQuestions).values(
      generatedQuestions.map((q: any) => ({
        tenderId: id,
        questionText: q.question_text || q.questionText,
        rationale: q.rationale || null,
        category: q.category || 'Overig',
        priority: (q.priority as any) || 'medium',
        status: 'draft' as const,
        aiGenerated: true,
        createdBy: userId,
      }))
    ).returning()

    return NextResponse.json(inserted)
  } catch (error) {
    console.error('Generate questions error:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
