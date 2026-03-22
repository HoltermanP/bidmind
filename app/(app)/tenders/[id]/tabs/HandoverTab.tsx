'use client'

import { useEffect, useRef, useState } from 'react'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { formatDateTime } from '@/lib/utils/format'
import { displayTenderTitle } from '@/lib/tenders/resolve-project-title'

interface TenderHandoverSlice {
  id: string
  title?: string | null
  handoverPlanHtml?: string | null
  handoverPresentationHtml?: string | null
  handoverReportStatus?: string | null
  handoverReportGeneratedAt?: Date | string | null
  handoverGammaGenerationId?: string | null
  handoverGammaStatus?: string | null
  handoverGammaUrl?: string | null
  handoverGammaExportUrl?: string | null
  handoverGammaError?: string | null
}

interface Props {
  tender: TenderHandoverSlice
  onTenderUpdate: (updates: Partial<TenderHandoverSlice>) => void
}

export default function HandoverTab({ tender, onTenderUpdate }: Props) {
  const { toast } = useToast()
  const onTenderUpdateRef = useRef(onTenderUpdate)
  onTenderUpdateRef.current = onTenderUpdate
  const printRef = useRef<HTMLDivElement>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pptxLoading, setPptxLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [alsoGamma, setAlsoGamma] = useState(false)
  const [gammaStarting, setGammaStarting] = useState(false)
  const [panel, setPanel] = useState<'plan' | 'presentation'>('plan')

  const status = tender.handoverReportStatus as string | undefined
  const planHtml = tender.handoverPlanHtml as string | undefined
  const presentationHtml = tender.handoverPresentationHtml as string | undefined
  const generatedAt = tender.handoverReportGeneratedAt
  const hasOutput = Boolean(planHtml && presentationHtml)
  const gammaStatus = tender.handoverGammaStatus as string | undefined
  const gammaPending = gammaStatus === 'pending'
  const gammaDone = gammaStatus === 'completed'
  const gammaFailed = gammaStatus === 'failed'

  const startGammaPresentation = async () => {
    setGammaStarting(true)
    try {
      const res = await fetch(`/api/tenders/${tender.id}/handover-gamma`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast(body.error || 'Gamma starten mislukt', 'error')
        return
      }
      onTenderUpdateRef.current(body)
      toast('Gamma-presentatie gestart; dit kan enkele minuten duren…', 'success')
    } catch {
      toast('Gamma starten mislukt', 'error')
    } finally {
      setGammaStarting(false)
    }
  }

  useEffect(() => {
    if (!gammaPending || !tender.id) return
    let cancelled = false
    let attempts = 0
    const maxAttempts = 120

    const poll = async () => {
      if (cancelled) return
      attempts += 1
      if (attempts > maxAttempts) {
        toast('Gamma: time-out bij status. Vernieuw de pagina of probeer opnieuw.', 'error')
        return
      }
      try {
        const res = await fetch(`/api/tenders/${tender.id}/handover-gamma`)
        const body = await res.json().catch(() => ({}))
        if (!res.ok) return
        if (body.tender) onTenderUpdateRef.current(body.tender)
        const g = body.gamma as { status?: string; error?: string } | undefined
        if (g?.status === 'completed') {
          toast('Gamma-presentatie gereed', 'success')
        } else if (g?.status === 'failed') {
          toast(g.error || 'Gamma-generatie mislukt', 'error')
        }
      } catch {
        /* volgende poll */
      }
    }

    const id = window.setInterval(poll, 5000)
    void poll()
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [gammaPending, tender.id, toast])

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
      if (alsoGamma) {
        await startGammaPresentation()
      }
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
        tenderTitle: displayTenderTitle(tender.title) ?? null,
      })
    } catch {
      toast('PowerPoint-export mislukt', 'error')
    } finally {
      setPptxLoading(false)
    }
  }

  const busy = generating || status === 'processing' || gammaStarting

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
          Overdracht Agent: implementatieplan en presentatie. Optioneel: Gamma API voor een rijkere PPTX (beeld, lay-out).
        </span>
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: 'var(--text-secondary)',
            cursor: busy ? 'not-allowed' : 'pointer',
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={alsoGamma}
            disabled={busy}
            onChange={(e) => setAlsoGamma(e.target.checked)}
          />
          Ook Gamma (PPTX)
        </label>
        <Button size="sm" variant="secondary" onClick={handleGenerate} disabled={busy}>
          {busy ? 'Bezig…' : hasOutput ? 'Opnieuw genereren' : 'Plan & presentatie genereren'}
        </Button>
        {hasOutput && (
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={startGammaPresentation}
              disabled={busy || gammaPending}
              title="Start een aparte Gamma-generatie op basis van de huidige presentatie-inhoud"
            >
              {gammaPending ? 'Gamma bezig…' : gammaStarting ? 'Gamma…' : 'Alleen Gamma starten'}
            </Button>
            <Button size="sm" variant="secondary" onClick={handleDownloadPptx} disabled={pptxLoading || busy}>
              {pptxLoading ? 'PowerPoint…' : 'Download PowerPoint (lokaal .pptx)'}
            </Button>
            <Button size="sm" onClick={handleDownloadPdf} disabled={pdfLoading || busy}>
              {pdfLoading ? 'PDF…' : 'Download PDF'}
            </Button>
          </>
        )}
      </div>

      {gammaPending && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Gamma verwerkt je presentatie. Dit kan enkele minuten duren; de status wordt automatisch ververst.
        </p>
      )}

      {gammaDone && tender.handoverGammaExportUrl && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 10,
            marginBottom: 16,
            padding: '10px 12px',
            borderRadius: 8,
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            fontSize: 13,
          }}
        >
          <span style={{ fontWeight: 600, color: 'var(--navy)' }}>Gamma-presentatie gereed</span>
          {tender.handoverGammaUrl ? (
            <a
              href={tender.handoverGammaUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--slate-blue)', textDecoration: 'underline' }}
            >
              Open in Gamma
            </a>
          ) : null}
          <a
            href={tender.handoverGammaExportUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--slate-blue)', textDecoration: 'underline' }}
          >
            Download PPTX (Gamma)
          </a>
        </div>
      )}

      {gammaFailed && tender.handoverGammaError && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            background: 'var(--error-bg)',
            color: 'var(--error)',
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          Gamma: {tender.handoverGammaError}
        </div>
      )}

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
              {tender.title ? <p className="tender-handover-pdf-cover-tender">{displayTenderTitle(tender.title)}</p> : null}
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
