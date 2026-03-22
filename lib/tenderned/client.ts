import type {
  TenderNedPublicatiesResponse,
  TenderNedPublicatie,
  TenderNedPublicatieMapped,
  TenderNedPublicatieDetail,
  TenderNedDocumentenResponse,
} from './types'
import { resolveProjectTitleFromTenderNed } from '@/lib/tenders/resolve-project-title'

const TNS_BASE = 'https://www.tenderned.nl/papi/tenderned-rs-tns/v2'

async function fetchTns(url: string, options: { timeout?: number; accept?: string } = {}) {
  const { timeout = 15000, accept = 'application/json' } = options
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url.startsWith('http') ? url : `${TNS_BASE.replace(/\/v2$/, '')}${url}`, {
      headers: {
        Accept: accept,
        'User-Agent': 'BidMind/1.0 (aanbestedingsondersteuning)',
      },
      signal: controller.signal,
      cache: 'no-store',
    })
    clearTimeout(timeoutId)
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`TenderNed API error: ${res.status} ${res.statusText}${body ? ` - ${body.slice(0, 200)}` : ''}`)
    }
    return res
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') throw new Error('TenderNed reageerde niet op tijd')
    throw err
  }
}

export interface FetchPublicatiesParams {
  page?: number
  size?: number
}

/** Haalt publicaties op van TenderNed TNS v2 (open data, geen auth). */
export async function fetchPublicaties(
  params: FetchPublicatiesParams = {}
): Promise<TenderNedPublicatiesResponse> {
  const { page = 0, size = 20 } = params
  const url = `${TNS_BASE}/publicaties?page=${page}&size=${size}`
  const res = await fetchTns(url)
  const data = (await res.json()) as TenderNedPublicatiesResponse
  if (!Array.isArray(data.content)) throw new Error('TenderNed gaf geen content-array terug')
  return data
}

/** Haalt detail van één publicatie op. */
export async function fetchPublicatieDetail(publicatieId: string): Promise<TenderNedPublicatieDetail> {
  const url = `${TNS_BASE}/publicaties/${publicatieId}`
  const res = await fetchTns(url)
  return res.json() as Promise<TenderNedPublicatieDetail>
}

/** Haalt de documentenlijst van een publicatie op. */
export async function fetchPublicatieDocumenten(publicatieId: string): Promise<TenderNedDocumentenResponse> {
  const url = `${TNS_BASE}/publicaties/${publicatieId}/documenten`
  const res = await fetchTns(url)
  const data = (await res.json()) as TenderNedDocumentenResponse
  if (!Array.isArray(data.documenten)) data.documenten = []
  return data
}

/** Haalt de binary content van een document op (voor AI-analyse). contentId uit links.download.href (het nummer voor /content). */
export async function fetchDocumentContent(publicatieId: string, contentId: string): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  const url = `${TNS_BASE}/publicaties/${publicatieId}/documenten/${contentId}/content`
  const res = await fetchTns(url, { accept: '*/*', timeout: 60000 })
  const contentType = res.headers.get('content-type') || 'application/octet-stream'
  const buffer = await res.arrayBuffer()
  return { buffer, contentType }
}

const TNS_ORIGIN = 'https://www.tenderned.nl'

/** Maakt volledige URL om een document te raadplegen. href is het relatief pad uit links.download. */
export function documentDownloadUrl(href: string): string {
  if (!href) return ''
  return href.startsWith('http') ? href : `${TNS_ORIGIN}${href}`
}

/** Haalt contentId uit links.download.href (bijv. /papi/.../documenten/13906231/content → "13906231"). */
export function parseContentIdFromHref(href: string): string | null {
  const m = href.match(/\/documenten\/(\d+)\/content/)
  return m ? m[1]! : null
}

/** Mapt een TenderNed-publicatie naar ons tender-achtige formaat. */
export function mapPublicatieToTender(p: TenderNedPublicatie): TenderNedPublicatieMapped {
  return {
    publicatieId: p.publicatieId,
    title: resolveProjectTitleFromTenderNed(p.aanbestedingNaam ?? '', p.opdrachtBeschrijving),
    referenceNumber: p.kenmerk != null ? String(p.kenmerk) : null,
    contractingAuthority: p.opdrachtgeverNaam ?? null,
    publicationDate: p.publicatieDatum ?? null,
    deadlineSubmission: p.sluitingsDatum ?? null,
    procedureType: p.procedure?.omschrijving ?? null,
    typeOpdracht: p.typeOpdracht?.omschrijving ?? null,
    description: p.opdrachtBeschrijving ?? null,
    tendernetUrl: p.link?.href ?? null,
  }
}
