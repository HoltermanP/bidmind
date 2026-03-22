import type { tenders } from '@/lib/db/schema'

type TenderRow = typeof tenders.$inferSelect

/** JSON voor AI-prompts (metadata); één vorm voor alle rapport-routes. */
export function tenderMetadataJson(t: TenderRow): string {
  return JSON.stringify(
    {
      title: t.title,
      referenceNumber: t.referenceNumber,
      contractingAuthority: t.contractingAuthority,
      procedureType: t.procedureType,
      estimatedValue: t.estimatedValue,
      cpvCodes: t.cpvCodes,
      publicationDate: t.publicationDate?.toISOString?.() ?? t.publicationDate,
      deadlineQuestions: t.deadlineQuestions?.toISOString?.() ?? t.deadlineQuestions,
      deadlineSubmission: t.deadlineSubmission?.toISOString?.() ?? t.deadlineSubmission,
      tendernetUrl: t.tendernetUrl,
      goNoGo: t.goNoGo,
      goNoGoReasoning: t.goNoGoReasoning,
      status: t.status,
    },
    null,
    2
  )
}
