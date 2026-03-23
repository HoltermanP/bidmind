import { db } from '@/lib/db'
import {
  tenders,
  users,
  tenderDocuments,
  tenderQuestions,
  tenderSections,
  tenderActivities,
  tenderNotes,
  lessonsLearned,
} from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import TenderDetailClient from './TenderDetailClient'

export const dynamic = 'force-dynamic'

async function getTenderData(id: string) {
  if (!db) return null
  const [tender] = await db.select().from(tenders).where(eq(tenders.id, id))
  if (!tender) return null

  const [documents, questions, sections, activities, notes, tenderLessons, allUsers] = await Promise.all([
    db.select().from(tenderDocuments).where(eq(tenderDocuments.tenderId, id)).orderBy(desc(tenderDocuments.uploadedAt)),
    db.select().from(tenderQuestions).where(eq(tenderQuestions.tenderId, id)).orderBy(desc(tenderQuestions.createdAt)),
    db.select().from(tenderSections).where(eq(tenderSections.tenderId, id)).orderBy(tenderSections.orderIndex),
    db.select().from(tenderActivities).where(eq(tenderActivities.tenderId, id)).orderBy(desc(tenderActivities.createdAt)).limit(50),
    db.select().from(tenderNotes).where(eq(tenderNotes.tenderId, id)).orderBy(desc(tenderNotes.createdAt)),
    db.select().from(lessonsLearned).where(eq(lessonsLearned.tenderId, id)).orderBy(desc(lessonsLearned.createdAt)),
    db.select().from(users),
  ])

  const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u]))
  return { tender, documents, questions, sections, activities, notes, lessonsLearned: tenderLessons, userMap, allUsers }
}

export default async function TenderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getTenderData(id)
  if (!data) notFound()

  return (
    <div style={{ height: '100%', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <TenderDetailClient {...data} />
    </div>
  )
}
