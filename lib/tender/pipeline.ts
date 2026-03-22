/**
 * Tender pipeline — dezelfde fases als op het dashboard, elk gekoppeld aan één AI-agent.
 * Gebruik op dashboard (funnel) en tenderdetail (huidige fase + agent).
 */
export const PIPELINE_STAGES = [
  'new',
  'qualifying',
  'analyzing',
  'writing',
  'review',
  'submitted',
  'won',
  'lost',
] as const

export type PipelineStageId = (typeof PIPELINE_STAGES)[number]

/** Tabbladen op de tenderdetailpagina (volgorde staat in de UI). */
export const TENDER_DETAIL_TAB_IDS = [
  'overview',
  'documents',
  'analysis',
  'questions',
  'sections',
  'timeline',
  'handover',
] as const

export type TenderDetailTabId = (typeof TENDER_DETAIL_TAB_IDS)[number]

export const TENDER_DETAIL_TAB_LABELS: Record<TenderDetailTabId, string> = {
  overview: 'Overzicht',
  handover: 'Overdracht',
  documents: 'Documenten',
  analysis: 'Tenderanalyse',
  questions: 'NVI Vragen',
  sections: 'Aanbieding',
  timeline: 'Tijdlijn',
}

/**
 * Welk tabblad hoort bij een pipeline-fase: klik op de stap opent dit tabblad
 * (samen met het opslaan van de fase in de tender).
 */
export const PIPELINE_STAGE_TO_TAB: Record<PipelineStageId, TenderDetailTabId> = {
  new: 'overview',
  qualifying: 'documents',
  analyzing: 'analysis',
  writing: 'sections',
  review: 'sections',
  submitted: 'timeline',
  won: 'handover',
  lost: 'timeline',
}

export const PIPELINE_WITHDRAWN_TAB: TenderDetailTabId = 'overview'

export function getTabForPipelineStatus(status: string): TenderDetailTabId {
  if (status === 'withdrawn') return PIPELINE_WITHDRAWN_TAB
  if ((PIPELINE_STAGES as readonly string[]).includes(status)) {
    return PIPELINE_STAGE_TO_TAB[status as PipelineStageId]
  }
  return 'overview'
}

/** Korte hint op tabknoppen: welke pipeline-fases hier logisch bij horen. */
export const TENDER_TAB_PIPELINE_HINT: Record<TenderDetailTabId, string> = {
  overview: 'Past bij pipeline: Nieuw, Ingetrokken',
  handover: 'Hoort bij pipeline: Gewonnen — Overdracht Agent (implementatieplan & presentatie). Tabblad staat altijd rechts; actief na gunning.',
  documents: 'Past bij pipeline: Kwalificatie (screening, documenten)',
  analysis: 'Past bij pipeline: Analyse',
  questions: 'NVI-vragen (handmatig; geen vaste pipeline-stap)',
  sections: 'Past bij pipeline: Schrijven en Review',
  timeline: 'Past bij pipeline: Ingediend en Verloren',
}

export const PIPELINE_AGENT_LABELS: Record<PipelineStageId, string> = {
  new: 'Intake Agent',
  qualifying: 'Screening Agent',
  analyzing: 'Analyse Agent',
  writing: 'Schrijf Agent',
  review: 'Review Agent',
  submitted: 'Monitor Agent',
  won: 'Overdracht Agent',
  lost: 'Evaluatie Agent',
}

/**
 * Korte ondertitel onder de fase op de tenderdetailpagina (geen dubbele woorden t.o.v. de fasenaam).
 * Volledige agentnaam staat in tooltips via PIPELINE_AGENT_LABELS + DESCRIPTIONS.
 */
export const PIPELINE_AGENT_TAGLINE: Record<PipelineStageId, string> = {
  new: 'Intake & scoping',
  qualifying: 'Match met profiel',
  analyzing: 'Bestek & criteria',
  writing: 'Conceptteksten',
  review: 'Kwaliteit & consistentie',
  submitted: 'Deadlines & besluit',
  won: 'Plan & overdracht',
  lost: 'Leren & verbeteren',
}

export const PIPELINE_AGENT_DESCRIPTIONS: Record<PipelineStageId, string> = {
  new: 'Scant binnenkomende tender automatisch: scope, sector, deadline, contractvorm (UAV-GC?), geschiktheid voor jullie profiel. Output: go/no-go advies + samenvatting.',
  qualifying:
    "Vergelijkt tendereisen met jullie competenties, referenties en bezetting. Signaleert risico's (te kort, te complex, buiten werkgebied). Output: kwalificatiescore + aanbeveling.",
  analyzing:
    'Diept de tender uit: technische eisen, gunningscriteria, weging, valkuilen in het bestek. Voor infra-tenders ook: contractrisico\'s, UAV-GC verplichtingen, systems engineering eisen. Output: gestructureerde analyse + aandachtspunten.',
  writing:
    'Genereert concept-antwoorden op kwalitatieve vragen op basis van eerdere inschrijvingen, referentieprojecten en bedrijfsprofiel. Output: eerste concept per gunningscriterium.',
  review:
    'Checkt de inschrijving op volledigheid, consistentie, toon en scorepotentieel. Vergelijkt met gunningscriteria. Output: reviewrapport met verbeterpunten.',
  submitted:
    'Houdt deadlines bij, signaleert verzoeken om aanvullende info, bewaakt de beslistermijn. Output: alerts + statusupdate.',
  won: 'Bereidt overdracht naar uitvoering voor: concreet implementatieplan (fasen, mijlpalen, risico’s, RACI) én een beknopte presentatiesamenvatting voor interne kick-off. Output: plan + slide-achtige presentatie (HTML).',
  lost: 'Analyseert de afwijzing (als feedback beschikbaar), vergelijkt met gewonnen concurrenten, leert voor de volgende inschrijving. Output: verbeterpunten voor het volgende tender.',
}
