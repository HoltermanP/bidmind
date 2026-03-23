'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { formatDateTime } from '@/lib/utils/format'

interface Doc {
  id: string
  fileName: string | null
  fileUrl: string | null
  documentType: string | null
}

interface LessonRow {
  id: string
  title: string
  category: string
  observation: string
  recommendation: string
  applicabilityHint: string | null
  impact: string | null
  tags: string[] | null
  sourceDocumentId: string | null
  createdAt: Date | null
}

interface Props {
  tenderId: string
  documents: Doc[]
  lessons: LessonRow[]
  onLessonsChange: (rows: LessonRow[]) => void
}

export default function LessonsLearnedTab({ tenderId, documents, lessons, onLessonsChange }: Props) {
  const { toast } = useToast()
  const [docId, setDocId] = useState('')
  const [evaluating, setEvaluating] = useState(false)

  const docsWithFile = documents.filter((d) => d.fileUrl)

  const refreshLessons = async () => {
    const res = await fetch(`/api/tenders/${tenderId}/lessons-learned`)
    if (!res.ok) return
    const data = await res.json()
    onLessonsChange(Array.isArray(data) ? data : [])
  }

  const runEvaluate = async () => {
    if (!docId) {
      toast('Kies een document met terugkoppeling', 'error')
      return
    }
    setEvaluating(true)
    try {
      const res = await fetch(`/api/tenders/${tenderId}/lessons-learned/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Evaluatie mislukt')
      const n = typeof data.inserted === 'number' ? data.inserted : 0
      toast(n > 0 ? `${n} leerpunt(en) opgeslagen` : 'Geen nieuwe leerpunten (tekst te mager of geen inhoud)', 'success')
      await refreshLessons()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Evaluatie mislukt', 'error')
    } finally {
      setEvaluating(false)
    }
  }

  const impactStyle = (impact: string | null) => {
    if (impact === 'hoog') return { bg: '#FEE2E2', color: '#991B1B' }
    if (impact === 'middel') return { bg: '#FEF3C7', color: '#92400E' }
    if (impact === 'laag') return { bg: '#E0E7FF', color: '#3730A3' }
    return { bg: '#F3F4F6', color: 'var(--text-secondary)' }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0, maxWidth: 900 }}>
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
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Syne, sans-serif', color: 'var(--navy)' }}>Leerpunten</span>
        {lessons.length > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{lessons.length} vastgelegd</span>
        )}
      </div>

      <div
        style={{
          padding: 20,
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: '#FAFAFA',
          marginBottom: 28,
        }}
      >
        <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>
          Evaluatie Agent
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 16 }}>
          Upload een terugkoppelingsdocument (PDF/DOCX) onder Documenten — bij voorkeur als type <strong>Terugkoppeling</strong>. Kies het bestand
          hieronder; de agent leest de tekst en zet concrete leerpunten in de database. Die worden automatisch meegenomen bij het genereren van
          aanbiedingssecties voor andere tenders.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220, flex: '1 1 220px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>Document</label>
            <select
              value={docId}
              onChange={(e) => setDocId(e.target.value)}
              style={{
                padding: '8px 10px',
                borderRadius: 4,
                border: '1px solid var(--border)',
                fontSize: 13,
                fontFamily: 'IBM Plex Sans, sans-serif',
                background: 'white',
              }}
            >
              <option value="">— Kies document —</option>
              {docsWithFile.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fileName || d.id}
                  {d.documentType === 'terugkoppeling' ? ' (terugkoppeling)' : ''}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" size="sm" loading={evaluating} onClick={runEvaluate} disabled={!docId}>
            Leerpunten extraheren
          </Button>
        </div>
        {docsWithFile.length === 0 && (
          <p style={{ fontSize: 12, color: '#B45309', marginTop: 12, marginBottom: 0 }}>
            Geen documenten met bestand op deze tender. Upload eerst een terugkoppeling onder het tabblad Documenten.
          </p>
        )}
      </div>

      {lessons.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Nog geen leerpunten voor deze tender.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {lessons.map((L) => {
            const st = impactStyle(L.impact)
            return (
              <div
                key={L.id}
                style={{
                  padding: 18,
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'white',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, fontFamily: 'Syne, sans-serif', color: 'var(--navy)', flex: '1 1 200px' }}>
                    {L.title}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '3px 10px',
                      borderRadius: 20,
                      background: '#EEF2FF',
                      color: '#4338CA',
                    }}
                  >
                    {L.category}
                  </span>
                  {L.impact && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        padding: '3px 8px',
                        borderRadius: 4,
                        background: st.bg,
                        color: st.color,
                      }}
                    >
                      {L.impact}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 10 }}>
                  <strong style={{ color: 'var(--navy)' }}>Observatie</strong>
                  <br />
                  {L.observation}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 10 }}>
                  <strong style={{ color: 'var(--navy)' }}>Aanbeveling volgende keer</strong>
                  <br />
                  {L.recommendation}
                </div>
                {L.applicabilityHint && (
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', marginBottom: 8 }}>
                    Toepassing: {L.applicabilityHint}
                  </div>
                )}
                {L.tags && L.tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {L.tags.map((t) => (
                      <span key={t} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: '#F3F4F6', color: 'var(--text-secondary)' }}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>Vastgelegd {formatDateTime(L.createdAt)}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
