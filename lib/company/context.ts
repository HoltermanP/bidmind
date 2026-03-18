/**
 * Bouwt een samenvatting van bedrijfsinformatie voor gebruik in AI-prompts
 * (documentanalyse, sectie-generatie, NVI-vragen).
 */
import { db } from '@/lib/db'
import { companySettings, companyDocuments } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

const SETTINGS_ID = 'default'

export async function getCompanyContext(): Promise<string> {
  if (!db) return ''

  const [settings] = await db.select().from(companySettings).where(eq(companySettings.id, SETTINGS_ID))
  const documents = await db.select().from(companyDocuments).orderBy(desc(companyDocuments.uploadedAt))

  const parts: string[] = []

  if (settings) {
    if (settings.companyName) parts.push(`Bedrijfsnaam: ${settings.companyName}`)
    if (settings.kvkNumber) parts.push(`KvK-nummer: ${settings.kvkNumber}`)
    if (settings.tendernedNumber) parts.push(`Inschrijfnummer TenderNed: ${settings.tendernedNumber}`)
    if (settings.websiteUrl) parts.push(`Website: ${settings.websiteUrl}`)
    if (settings.description) parts.push(`Bedrijfsomschrijving:\n${settings.description}`)
    if (settings.visionText) parts.push(`Visie/missie:\n${settings.visionText}`)
    if (settings.annualPlanText) parts.push(`Jaarplan/strategie:\n${settings.annualPlanText}`)
    if (settings.strengthsText) parts.push(`Sterke punten:\n${settings.strengthsText}`)
    if (settings.referencesText) parts.push(`Referenties/ervaring:\n${settings.referencesText}`)
  }

  documents.forEach((doc) => {
    const typeLabel = doc.documentType === 'vision' ? 'Visiedocument' : doc.documentType === 'year_plan' ? 'Jaarplan' : 'Document'
    if (doc.extractedText && doc.extractedText.trim()) {
      parts.push(`${typeLabel} (${doc.fileName}):\n${doc.extractedText.slice(0, 30000)}`)
    }
  })

  if (parts.length === 0) return ''
  return `--- Bedrijfscontext (gebruik voor maatwerk en aansluiting bij het bedrijf) ---\n${parts.join('\n\n')}\n--- Einde bedrijfscontext ---`
}
