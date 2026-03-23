import { pgTable, text, uuid, timestamp, decimal, integer, boolean, jsonb, pgEnum, index } from 'drizzle-orm/pg-core'

export const tenderStatusEnum = pgEnum('tender_status', ['new', 'qualifying', 'analyzing', 'writing', 'review', 'submitted', 'won', 'lost', 'withdrawn'])
export const goNoGoEnum = pgEnum('go_no_go', ['pending', 'go', 'no_go'])
export const documentTypeEnum = pgEnum('document_type', [
  'aankondiging',
  'bestek',
  'leidraad',
  'tekening',
  'nota_van_inlichtingen',
  'eigen_upload',
  'terugkoppeling',
  'concept_aanbieding',
  'definitief',
])
export const analysisStatusEnum = pgEnum('analysis_status', ['pending', 'processing', 'done', 'failed'])
export const questionPriorityEnum = pgEnum('question_priority', ['critical', 'high', 'medium', 'low'])
export const questionStatusEnum = pgEnum('question_status', ['draft', 'approved', 'submitted', 'answered', 'rejected'])
export const sectionTypeEnum = pgEnum('section_type', ['plan_van_aanpak', 'kwaliteit', 'prijs_onderbouwing', 'team_cv', 'referenties', 'vca_veiligheid', 'eigen_sectie'])
export const sectionStatusEnum = pgEnum('section_status', ['empty', 'draft', 'in_review', 'approved'])
export const noteTypeEnum = pgEnum('note_type', ['internal', 'decision', 'risk', 'milestone'])
export const userRoleEnum = pgEnum('user_role', ['admin', 'tender_manager', 'team_member'])
export const companyDocumentTypeEnum = pgEnum('company_document_type', ['vision', 'year_plan', 'other'])
/** Intake-agent: geschiktheid van de tender t.o.v. het bedrijf (laag / middel / hoog) */
export const tenderIntakeSuitabilityTierEnum = pgEnum('tender_intake_suitability_tier', ['low', 'medium', 'high'])

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email'),
  avatarUrl: text('avatar_url'),
  role: userRoleEnum('role').default('team_member'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const tenders = pgTable('tenders', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  referenceNumber: text('reference_number'),
  contractingAuthority: text('contracting_authority'),
  publicationDate: timestamp('publication_date'),
  deadlineQuestions: timestamp('deadline_questions'),
  deadlineSubmission: timestamp('deadline_submission'),
  estimatedValue: decimal('estimated_value', { precision: 12, scale: 2 }),
  cpvCodes: text('cpv_codes').array(),
  procedureType: text('procedure_type'),
  status: tenderStatusEnum('status').default('new'),
  goNoGo: goNoGoEnum('go_no_go').default('pending'),
  winProbability: integer('win_probability').default(0),
  /** Geschatte win-kans (0–100) uit de laatste tenderanalyse; handmatige Win% blijft in winProbability */
  winProbabilityEstimated: integer('win_probability_estimated'),
  tenderManagerId: text('tender_manager_id'),
  teamMemberIds: text('team_member_ids').array().default([]),
  tendernetUrl: text('tendernet_url'),
  tendernedPublicatieId: text('tenderned_publicatie_id'),
  /** Korte omschrijving uit TenderNed (opdrachtBeschrijving); gebruikt door intake-geschiktheid */
  tenderDescription: text('tender_description'),
  goNoGoReasoning: text('go_no_go_reasoning'),
  /** Intake-agent: geschiktheid t.o.v. bedrijfsprofiel; auto na import alleen voor de N nieuwste tenders (zie lib/tenders/intake-suitability) */
  intakeSuitabilityTier: tenderIntakeSuitabilityTierEnum('intake_suitability_tier'),
  intakeSuitabilityScore: integer('intake_suitability_score'),
  intakeSuitabilitySummary: text('intake_suitability_summary'),
  intakeSuitabilityStatus: analysisStatusEnum('intake_suitability_status').default('pending'),
  intakeSuitabilityGeneratedAt: timestamp('intake_suitability_generated_at'),
  /** Uitgebreide tenderanalyse (Analyse Agent): semantische HTML, veilig gesanitized */
  analysisReportHtml: text('analysis_report_html'),
  analysisReportStatus: analysisStatusEnum('analysis_report_status').default('pending'),
  analysisReportGeneratedAt: timestamp('analysis_report_generated_at'),
  /** Review van de aanbieding (Review Agent): HTML-rapport, veilig gesanitized */
  reviewReportHtml: text('review_report_html'),
  reviewReportStatus: analysisStatusEnum('review_report_status').default('pending'),
  reviewReportGeneratedAt: timestamp('review_report_generated_at'),
  /** Overdracht na gunning (Overdracht Agent): implementatieplan + presentatiesamenvatting, gesanitized */
  handoverPlanHtml: text('handover_plan_html'),
  handoverPresentationHtml: text('handover_presentation_html'),
  handoverReportStatus: analysisStatusEnum('handover_report_status').default('pending'),
  handoverReportGeneratedAt: timestamp('handover_report_generated_at'),
  /** Optionele Gamma API: presentatie + export (.pptx) via public-api.gamma.app */
  handoverGammaGenerationId: text('handover_gamma_generation_id'),
  handoverGammaStatus: text('handover_gamma_status'),
  handoverGammaUrl: text('handover_gamma_url'),
  handoverGammaExportUrl: text('handover_gamma_export_url'),
  handoverGammaError: text('handover_gamma_error'),
  notesCount: integer('notes_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  statusIdx: index('tenders_status_idx').on(table.status),
  managerIdx: index('tenders_manager_idx').on(table.tenderManagerId),
}))

export const tenderDocuments = pgTable('tender_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenderId: uuid('tender_id').references(() => tenders.id, { onDelete: 'cascade' }),
  fileName: text('file_name'),
  fileUrl: text('file_url'),
  fileSize: integer('file_size'),
  documentType: documentTypeEnum('document_type').default('eigen_upload'),
  analysisStatus: analysisStatusEnum('analysis_status').default('pending'),
  analysisSummary: text('analysis_summary'),
  analysisJson: jsonb('analysis_json'),
  uploadedBy: text('uploaded_by'),
  uploadedAt: timestamp('uploaded_at').defaultNow(),
  tendernedContentId: text('tenderned_content_id'),
}, (table) => ({
  tenderIdx: index('documents_tender_idx').on(table.tenderId),
}))

export const tenderQuestions = pgTable('tender_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenderId: uuid('tender_id').references(() => tenders.id, { onDelete: 'cascade' }),
  questionText: text('question_text'),
  rationale: text('rationale'),
  category: text('category'),
  priority: questionPriorityEnum('priority').default('medium'),
  status: questionStatusEnum('status').default('draft'),
  answerText: text('answer_text'),
  aiGenerated: boolean('ai_generated').default(false),
  submittedAt: timestamp('submitted_at'),
  answeredAt: timestamp('answered_at'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  tenderIdx: index('questions_tender_idx').on(table.tenderId),
}))

export const tenderSections = pgTable('tender_sections', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenderId: uuid('tender_id').references(() => tenders.id, { onDelete: 'cascade' }),
  sectionType: sectionTypeEnum('section_type').default('eigen_sectie'),
  title: text('title'),
  content: text('content').default(''),
  aiGenerated: boolean('ai_generated').default(false),
  wordCount: integer('word_count').default(0),
  status: sectionStatusEnum('status').default('empty'),
  orderIndex: integer('order_index').default(0),
  lastEditedBy: text('last_edited_by'),
  lastEditedAt: timestamp('last_edited_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  tenderIdx: index('sections_tender_idx').on(table.tenderId),
}))

export const tenderActivities = pgTable('tender_activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenderId: uuid('tender_id').references(() => tenders.id, { onDelete: 'cascade' }),
  userId: text('user_id'),
  activityType: text('activity_type'),
  description: text('description'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  tenderIdx: index('activities_tender_idx').on(table.tenderId),
  createdIdx: index('activities_created_idx').on(table.createdAt),
}))

/** Leerpunten uit aanbestedingsterugkoppeling (Evaluatie Agent); herbruikbaar bij nieuwe inschrijvingen. */
export const lessonsLearned = pgTable(
  'lessons_learned',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenderId: uuid('tender_id')
      .references(() => tenders.id, { onDelete: 'cascade' })
      .notNull(),
    sourceDocumentId: uuid('source_document_id').references(() => tenderDocuments.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    category: text('category').notNull(),
    observation: text('observation').notNull(),
    recommendation: text('recommendation').notNull(),
    applicabilityHint: text('applicability_hint'),
    impact: text('impact'),
    tags: text('tags').array(),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    tenderIdx: index('lessons_learned_tender_idx').on(table.tenderId),
    createdIdx: index('lessons_learned_created_idx').on(table.createdAt),
  })
)

export const tenderNotes = pgTable('tender_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenderId: uuid('tender_id').references(() => tenders.id, { onDelete: 'cascade' }),
  authorId: text('author_id'),
  content: text('content'),
  noteType: noteTypeEnum('note_type').default('internal'),
  createdAt: timestamp('created_at').defaultNow(),
})

// Eén rij: bedrijfsgegevens voor AI-analyse en maatwerk aanbiedingen
export const companySettings = pgTable('company_settings', {
  id: text('id').primaryKey().default('default'),
  companyName: text('company_name'),
  kvkNumber: text('kvk_number'),
  tendernedNumber: text('tenderned_number'),
  defaultTenderManagerId: text('default_tender_manager_id'),
  websiteUrl: text('website_url'),
  description: text('description'),
  visionText: text('vision_text'),
  annualPlanText: text('annual_plan_text'),
  strengthsText: text('strengths_text'),
  referencesText: text('references_text'),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const companyDocuments = pgTable('company_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentType: companyDocumentTypeEnum('document_type').notNull(),
  fileName: text('file_name').notNull(),
  fileUrl: text('file_url'),
  fileSize: integer('file_size'),
  extractedText: text('extracted_text'),
  uploadedAt: timestamp('uploaded_at').defaultNow(),
})
