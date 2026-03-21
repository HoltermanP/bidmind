/**
 * Per-agent configuratie: platform (OpenAI of Anthropic) en model.
 * Kwaliteit gaat voor kosten; goedkoper model als dat voldoende kwaliteit levert.
 *
 * - Zwaardere analysetaken (documentanalyse) → Anthropic Claude (sterk model)
 * - Zwaardere schrijftaken (sectieteksten) → Anthropic Claude (sterk model)
 * - Lichtere gestructureerde taken (vraagengeneratie) → OpenAI (goedkoper, voldoende kwaliteit)
 */

export type AIPlatform = 'openai' | 'anthropic'

export type AgentId = 'document_analysis' | 'tender_analysis_report' | 'section_writing' | 'question_generation'

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
 * - section_writing: zware schrijftaak → Claude (sterke schrijfkwaliteit)
 * - question_generation: gestructureerde output uit samenvattingen → OpenAI goedkoper model volstaat
 */
export const AGENT_CONFIG: Record<AgentId, AgentConfig> = {
  document_analysis: {
    platform: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 1500,
  },
  tender_analysis_report: {
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
}

export function getAgentConfig(agentId: AgentId): AgentConfig {
  return AGENT_CONFIG[agentId]
}
