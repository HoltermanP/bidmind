'use client'

import { useRef, useState } from 'react'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { formatDateTime } from '@/lib/utils/format'

interface TenderAnalysisSlice {
  id: string
  title?: string | null
  referenceNumber?: string | null
  analysisReportHtml?: string | null
  analysisReportStatus?: string | null
  analysisReportGeneratedAt?: Date | string | null
  winProbabilityEstimated?: number | null
}

interface DocumentAnalysisRow {
  analysisStatus?: string | null
  analysisJson?: unknown
}

interface Props {
  tender: TenderAnalysisSlice
  /** Nodig om te bepalen of documentanalyse al klaar is (los van het tender-HTML-rapport). */
  documents: DocumentAnalysisRow[]
  onTenderUpdate: (updates: Partial<TenderAnalysisSlice>) => void
}

export default function AnalysisTab({ tender, documents, onTenderUpdate }: Props) {
  const { toast } = useToast()
  const printRef = useRef<HTMLDivElement>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [generating, setGenerating] = useState(false)

  const status = tender.analysisReportStatus as string | undefined
  const html = tender.analysisReportHtml as string | undefined
  const generatedAt = tender.analysisReportGeneratedAt

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await fetch(`/api/tenders/${tender.id}/analysis-report`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        const sync = await fetch(`/api/tenders/${tender.id}`)
        if (sync.ok) onTenderUpdate(await sync.json())
        toast(body.error || 'Genereren mislukt', 'error')
        return
      }
      onTenderUpdate(body)
      toast('Tenderanalyse gereed', 'success')
    } catch {
      const sync = await fetch(`/api/tenders/${tender.id}`)
      if (sync.ok) onTenderUpdate(await sync.json())
      toast('Genereren mislukt', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const handleDownloadPdf = async () => {
    const el = printRef.current
    if (!el) return
    setPdfLoading(true)
    try {
      const { default: html2pdf } = await import('html2pdf.js')
      const base =
        (tender.referenceNumber || tender.title || 'tender-analyse')
          .toString()
          .replace(/[^\w\d\-_.\s]+/g, '_')
          .trim()
          .slice(0, 80) || 'tender-analyse'
      await html2pdf()
        .set({
          margin: [14, 12, 14, 12],
          filename: `${base}.pdf`,
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(el)
        .save()
    } catch {
      toast('PDF-export mislukt', 'error')
    } finally {
      setPdfLoading(false)
    }
  }

  const busy = generating || status === 'processing'

  /** Zelfde voorwaarde als POST /analysis-report: minstens één document met status done én analysisJson. */
  const hasAnalyzedDocuments = documents.some((d) => d.analysisStatus === 'done' && Boolean(d.analysisJson))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0, maxWidth: '100%' }}>
      <div
        className="tender-tab-actions"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          padding: '14px 0',
          marginBottom: 20,
          borderBottom: '1px solid #E5E7EB',
          minWidth: 0,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Syne, sans-serif', color: 'var(--navy)' }}>
          Tenderanalyse
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1, minWidth: 120 }}>
          Uitgebreid rapport (Analyse Agent) op basis van geanalyseerde documenten — HTML-weergave en PDF.
        </span>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleGenerate}
          disabled={busy || !hasAnalyzedDocuments}
        >
          {busy ? 'Bezig…' : html ? 'Opnieuw genereren' : 'Analyse genereren'}
        </Button>
        {html && (
          <Button size="sm" onClick={handleDownloadPdf} disabled={pdfLoading || busy}>
            {pdfLoading ? 'PDF…' : 'Download PDF'}
          </Button>
        )}
      </div>

      {status === 'failed' && !busy && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 6,
            background: 'var(--error-bg)',
            color: 'var(--error)',
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          De laatste generatie is mislukt. Controleer de AI-configuratie en probeer opnieuw.
        </div>
      )}

      {busy && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          De Analyse Agent werkt het rapport bij. Dit kan een minuut duren…
        </p>
      )}

      {!html && !busy && status !== 'processing' && (
        <div
          style={{
            padding: 24,
            border: '1px dashed var(--border)',
            borderRadius: 8,
            background: '#fafafa',
            fontSize: 13,
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
          }}
        >
          {hasAnalyzedDocuments ? (
            <>
              <strong style={{ color: 'var(--text-primary)' }}>Nog geen tenderanalyse-rapport.</strong> Je
              documenten zijn al geanalyseerd: klik op <strong>Analyse genereren</strong> hierboven om het uitgebreide
              HTML-rapport te laten maken (zichtbaar hier en te exporteren als PDF). Dit is een aparte stap na de
              per-document analyse.
            </>
          ) : (
            <>
              <strong style={{ color: 'var(--text-primary)' }}>Eerst documentanalyse.</strong> Ga naar het tabblad{' '}
              <strong>Documenten</strong>, upload bestanden en start daar per document (of &quot;Analyseer alle&quot;) de
              AI-analyse. Daarna kun je hier het volledige tenderanalyse-rapport genereren. Dat rapport bevat onder meer
              scope, technische eisen, gunningscriteria, contract- en UAV-GC-risico’s, planning en NVI-aandachtspunten.
            </>
          )}
        </div>
      )}

      {html && (
        <div style={{ marginTop: 4 }}>
          {(generatedAt || tender.winProbabilityEstimated != null) && (
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
              {generatedAt && <>Laatst gegenereerd: {formatDateTime(generatedAt)}</>}
              {generatedAt && tender.winProbabilityEstimated != null && ' · '}
              {tender.winProbabilityEstimated != null && (
                <>Geschatte win-kans uit analyse: {tender.winProbabilityEstimated}% (aanpasbaar bij Win% hierboven)</>
              )}
            </p>
          )}
          <div ref={printRef} className="tender-analysis-print-root">
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </div>
      )}
    </div>
  )
}
