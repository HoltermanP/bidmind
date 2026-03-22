'use client'

import { useRef, useState } from 'react'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { formatDateTime } from '@/lib/utils/format'

interface TenderHandoverSlice {
  id: string
  title?: string | null
  handoverPlanHtml?: string | null
  handoverPresentationHtml?: string | null
  handoverReportStatus?: string | null
  handoverReportGeneratedAt?: Date | string | null
}

interface Props {
  tender: TenderHandoverSlice
  onTenderUpdate: (updates: Partial<TenderHandoverSlice>) => void
}

export default function HandoverTab({ tender, onTenderUpdate }: Props) {
  const { toast } = useToast()
  const printRef = useRef<HTMLDivElement>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pptxLoading, setPptxLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [panel, setPanel] = useState<'plan' | 'presentation'>('plan')

  const status = tender.handoverReportStatus as string | undefined
  const planHtml = tender.handoverPlanHtml as string | undefined
  const presentationHtml = tender.handoverPresentationHtml as string | undefined
  const generatedAt = tender.handoverReportGeneratedAt
  const hasOutput = Boolean(planHtml && presentationHtml)

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await fetch(`/api/tenders/${tender.id}/handover-report`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        const sync = await fetch(`/api/tenders/${tender.id}`)
        if (sync.ok) onTenderUpdate(await sync.json())
        toast(body.error || 'Genereren mislukt', 'error')
        return
      }
      onTenderUpdate(body)
      toast('Overdrachtsrapport gereed', 'success')
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
        ('overdracht-' + (tender.id || 'tender'))
          .toString()
          .replace(/[^\w\d\-_.\s]+/g, '_')
          .trim()
          .slice(0, 80) || 'overdracht'
      await html2pdf()
        .set({
          margin: [14, 12, 14, 12],
          filename: `${base}.pdf`,
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true },
          pagebreak: { mode: ['css', 'legacy'], avoid: ['.handover-slide'] },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        } as never)
        .from(el)
        .save()
    } catch {
      toast('PDF-export mislukt', 'error')
    } finally {
      setPdfLoading(false)
    }
  }

  const handleDownloadPptx = async () => {
    if (!presentationHtml) return
    setPptxLoading(true)
    try {
      const { downloadHandoverPresentationPptx } = await import('@/lib/handover/handover-presentation-to-pptx')
      const base =
        ('overdracht-' + (tender.id || 'tender'))
          .toString()
          .replace(/[^\w\d\-_.\s]+/g, '_')
          .trim()
          .slice(0, 80) || 'overdracht'
      await downloadHandoverPresentationPptx({
        presentationHtml,
        fileBaseName: base,
        tenderTitle: tender.title ?? null,
      })
    } catch {
      toast('PowerPoint-export mislukt', 'error')
    } finally {
      setPptxLoading(false)
    }
  }

  const busy = generating || status === 'processing'

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
          Overdracht
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1, minWidth: 120 }}>
          Overdracht Agent: implementatieplan en een PowerPoint-presentatie (exporteerbaar als .pptx).
        </span>
        <Button size="sm" variant="secondary" onClick={handleGenerate} disabled={busy}>
          {busy ? 'Bezig…' : hasOutput ? 'Opnieuw genereren' : 'Plan & presentatie genereren'}
        </Button>
        {hasOutput && (
          <>
            <Button size="sm" variant="secondary" onClick={handleDownloadPptx} disabled={pptxLoading || busy}>
              {pptxLoading ? 'PowerPoint…' : 'Download PowerPoint (.pptx)'}
            </Button>
            <Button size="sm" onClick={handleDownloadPdf} disabled={pdfLoading || busy}>
              {pdfLoading ? 'PDF…' : 'Download PDF'}
            </Button>
          </>
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
          De Overdracht Agent werkt aan je plan en presentatie. Dit kan een minuut duren…
        </p>
      )}

      {!hasOutput && !busy && status !== 'processing' && (
        <div
          style={{
            padding: 24,
            border: '1px dashed var(--border)',
            borderRadius: 8,
            background: '#fafafa',
            fontSize: 13,
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            marginBottom: 16,
          }}
        >
          <strong style={{ color: 'var(--text-primary)' }}>Nog geen overdrachtsrapport.</strong> Zorg dat minstens één
          aanbiedingssectie tekst bevat (tabblad Aanbieding); één sectie volstaat. Bij meerdere secties worden die allemaal
          gebruikt. Klik daarna op <strong>Plan & presentatie genereren</strong> voor een implementatieplan en een
          presentatie (ook te downloaden als PowerPoint).
        </div>
      )}

      {hasOutput && (
        <>
          {generatedAt && (
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
              Laatst gegenereerd: {formatDateTime(generatedAt)}
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setPanel('plan')}
              style={{
                padding: '8px 14px',
                borderRadius: 6,
                border: panel === 'plan' ? '1.5px solid var(--slate-blue)' : '1px solid var(--border)',
                background: panel === 'plan' ? '#E0F2FE' : 'white',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'IBM Plex Sans, sans-serif',
                color: panel === 'plan' ? 'var(--slate-blue)' : 'var(--text-secondary)',
              }}
            >
              Implementatieplan
            </button>
            <button
              type="button"
              onClick={() => setPanel('presentation')}
              style={{
                padding: '8px 14px',
                borderRadius: 6,
                border: panel === 'presentation' ? '1.5px solid var(--slate-blue)' : '1px solid var(--border)',
                background: panel === 'presentation' ? '#E0F2FE' : 'white',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'IBM Plex Sans, sans-serif',
                color: panel === 'presentation' ? 'var(--slate-blue)' : 'var(--text-secondary)',
              }}
            >
              Presentatie (PowerPoint)
            </button>
          </div>

          <div className="tender-handover-print-root tender-handover-screen-view">
            {panel === 'plan' && planHtml && (
              <div className="section-content-preview">
                <div dangerouslySetInnerHTML={{ __html: planHtml }} />
              </div>
            )}
            {panel === 'presentation' && presentationHtml && (
              <div dangerouslySetInnerHTML={{ __html: presentationHtml }} />
            )}
          </div>
          {/* Volledige bundel voor PDF (html2pdf); buiten beeld */}
          <div ref={printRef} className="tender-handover-print-root tender-handover-pdf-bundle" aria-hidden>
            <header className="tender-handover-pdf-cover">
              <h1 className="tender-handover-pdf-cover-title">Overdracht</h1>
              {tender.title ? <p className="tender-handover-pdf-cover-tender">{tender.title}</p> : null}
              {generatedAt ? (
                <p className="tender-handover-pdf-cover-meta">Gegenereerd: {formatDateTime(generatedAt)}</p>
              ) : null}
            </header>
            <section>
              <h2 className="tender-handover-pdf-section-title">Implementatieplan</h2>
              {planHtml ? (
                <div className="section-content-preview">
                  <div dangerouslySetInnerHTML={{ __html: planHtml }} />
                </div>
              ) : null}
            </section>
            <hr className="tender-handover-pdf-divider" />
            <section>
              <h2 className="tender-handover-pdf-section-title">Presentatie (PowerPoint)</h2>
              {presentationHtml ? <div dangerouslySetInnerHTML={{ __html: presentationHtml }} /> : null}
            </section>
          </div>
        </>
      )}
    </div>
  )
}
