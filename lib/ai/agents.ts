/**
 * Per-agent configuratie: platform (OpenAI of Anthropic) en model.
 * Kwaliteit gaat voor kosten; goedkoper model als dat voldoende kwaliteit levert.
 *
 * - Zwaardere analysetaken (documentanalyse) → Anthropic Claude (sterk model)
 * - Zwaardere schrijftaken (sectieteksten) → Anthropic Claude (sterk model)
 * - Lichtere gestructureerde taken (vraagengeneratie) → OpenAI (goedkoper, voldoende kwaliteit)
 */

export type AIPlatform = 'openai' | 'anthropic'

export type AgentId =
  | 'document_analysis'
  | 'tender_analysis_report'
  | 'tender_review_report'
  | 'handover_report'
  | 'section_writing'
  | 'question_generation'
  | 'intake_suitability'
  | 'lessons_learned'

export interface AgentConfig {
  platform: AIPlatform
  model: string
  /** Optioneel: max_tokens override (anders default per run) */
  maxTokens?: number
}

/**
 * Aanbevolen keuze per agent:
 * - document_analysis: zware analyse → Claude (beste kwaliteit voor lange documenten)
 * - tender_analysis_report: uitgebreide tenderanalyse als HTML-document → Claude
 * - tender_review_report: reviewrapport aanbieding vs. criteria → Claude
 * - handover_report: implementatieplan + presentatie na gunning → Claude
 * - section_writing: zware schrijftaak → Claude (sterke schrijfkwaliteit)
 * - question_generation: gestructureerde output uit samenvattingen → OpenAI goedkoper model volstaat
 * - intake_suitability: snelle JSON-score geschiktheid tender vs. bedrijf → OpenAI (goedkoop, voldoende)
 * - lessons_learned: terugkoppeling → gestructureerde leerpunten voor volgende inschrijvingen → Claude
 */
export const AGENT_CONFIG: Record<AgentId, AgentConfig> = {
  document_analysis: {
    platform: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    /** Genoeg ruimte voor volledig JSON-object (summary + arrays); te kort gaf afgeknipte output en parse-fouten. */
    maxTokens: 8192,
  },
  tender_analysis_report: {
    platform: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 16384,
  },
  tender_review_report: {
    platform: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 16384,
  },
  handover_report: {
    platform: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 16384,
  },
  section_writing: {
    platform: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 16384, // Ruim genoeg voor uitgebreide secties (plan van aanpak, etc.); voorkomt afkappen
  },
  question_generation: {
    platform: 'openai',
    model: 'gpt-4o-mini',
    maxTokens: 2000,
  },
  intake_suitability: {
    platform: 'openai',
    model: 'gpt-4o-mini',
    /** Kort JSON-antwoord; lagere limiet = iets minder outputkosten */
    maxTokens: 512,
  },
  lessons_learned: {
    platform: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 8192,
  },
}

export function getAgentConfig(agentId: AgentId): AgentConfig {
  return AGENT_CONFIG[agentId]
}
