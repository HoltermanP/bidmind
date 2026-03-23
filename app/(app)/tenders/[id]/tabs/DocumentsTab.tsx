'use client'

import { useState, useRef, type Dispatch, type SetStateAction } from 'react'
import { useToast } from '@/components/ui/Toast'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { formatFileSize, formatDateTime } from '@/lib/utils/format'

interface Document {
  id: string
  fileName: string | null
  fileUrl: string | null
  fileSize: number | null
  documentType: string | null
  analysisStatus: string | null
  analysisSummary: string | null
  analysisJson: any
  uploadedAt: Date | null
}

interface Props {
  tender: any
  documents: Document[]
  onDocumentsChange: Dispatch<SetStateAction<Document[]>>
  userMap: Record<string, any>
}

const DOC_TYPES = [
  { value: 'aankondiging', label: 'Aankondiging' },
  { value: 'bestek', label: 'Bestek' },
  { value: 'leidraad', label: 'Leidraad' },
  { value: 'tekening', label: 'Tekening' },
  { value: 'nota_van_inlichtingen', label: 'Nota van Inlichtingen' },
  { value: 'eigen_upload', label: 'Eigen upload' },
  { value: 'terugkoppeling', label: 'Terugkoppeling (evaluatie)' },
  { value: 'concept_aanbieding', label: 'Concept aanbieding' },
  { value: 'definitief', label: 'Definitief' },
]

export default function DocumentsTab({ tender, documents, onDocumentsChange, userMap }: Props) {
  const { toast } = useToast()
  const [analyzing, setAnalyzing] = useState<Set<string>>(new Set())
  const [clearingAnalysis, setClearingAnalysis] = useState<Set<string>>(new Set())
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploadDocumentType, setUploadDocumentType] = useState<string>('eigen_upload')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('tenderId', tender.id)
        formData.append('documentType', uploadDocumentType)

        const res = await fetch(`/api/tenders/${tender.id}/documents/upload`, {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) throw new Error('Upload mislukt')
        const doc = await res.json()
        onDocumentsChange((prev) => [doc, ...prev])
        toast(`${file.name} geüpload`, 'success')
      } catch (err) {
        toast(`Upload mislukt voor ${file.name}`, 'error')
      }
    }

    setUploading(false)
  }

  const analyzeDocument = async (doc: Document) => {
    setAnalyzing((prev) => new Set([...prev, doc.id]))
    try {
      const res = await fetch(`/api/tenders/${tender.id}/documents/${doc.id}/analyze`, {
        method: 'POST',
      })
      const updated = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = typeof updated.error === 'string' ? updated.error : `Analyse mislukt (${res.status})`
        throw new Error(msg)
      }
      onDocumentsChange((prev) => prev.map((d) => (d.id === doc.id ? updated : d)))
      if (selectedDoc?.id === doc.id) setSelectedDoc(updated)
      if (updated.analysisStatus === 'failed') {
        toast('Analyse mislukt — geen risico\'s of samenvatting opgeslagen', 'error')
      } else {
        toast('Analyse voltooid', 'success')
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Analyse mislukt', 'error')
    } finally {
      setAnalyzing((prev) => { const s = new Set(prev); s.delete(doc.id); return s })
    }
  }

  const analyzeAll = async () => {
    const pending = documents.filter((d) => d.analysisStatus !== 'done')
    for (const doc of pending) {
      await analyzeDocument(doc)
    }
  }

  const deleteDocument = async (doc: Document) => {
    try {
      await fetch(`/api/tenders/${tender.id}/documents/${doc.id}`, { method: 'DELETE' })
      onDocumentsChange((prev) => prev.filter((d) => d.id !== doc.id))
      if (selectedDoc?.id === doc.id) setSelectedDoc(null)
      toast('Document verwijderd', 'info')
    } catch {
      toast('Verwijderen mislukt', 'error')
    }
  }

  const clearDocumentAnalysis = async (doc: Document) => {
    if (
      !confirm(
        'Documentanalyse wissen? De bijbehorende risico-indicatoren verdwijnen uit het overzicht; je kunt later opnieuw analyseren.'
      )
    ) {
      return
    }
    setClearingAnalysis((prev) => new Set([...prev, doc.id]))
    try {
      const res = await fetch(`/api/tenders/${tender.id}/documents/${doc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearAnalysis: true }),
      })
      const updated = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = typeof updated.error === 'string' ? updated.error : `Wissen mislukt (${res.status})`
        throw new Error(msg)
      }
      onDocumentsChange((prev) => prev.map((d) => (d.id === doc.id ? updated : d)))
      if (selectedDoc?.id === doc.id) setSelectedDoc(updated)
      toast('Documentanalyse gewist', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Wissen mislukt', 'error')
    } finally {
      setClearingAnalysis((prev) => {
        const s = new Set(prev)
        s.delete(doc.id)
        return s
      })
    }
  }

  const groupedDocs = documents.reduce<Record<string, Document[]>>((acc, doc) => {
    const type = doc.documentType || 'eigen_upload'
    if (!acc[type]) acc[type] = []
    acc[type].push(doc)
    return acc
  }, {})

  const ANALYSIS_STATUS_LABEL: Record<string, string> = {
    pending: 'Wachten',
    processing: 'Verwerken...',
    done: 'Geanalyseerd',
    failed: 'Mislukt',
  }
  const ANALYSIS_STATUS_COLOR: Record<string, string> = {
    pending: 'var(--muted)',
    processing: '#B45309',
    done: '#059669',
    failed: '#DC2626',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0, maxWidth: '100%' }}>
      {/* Actiebalk –zelfde opmaak als NVI Vragen en Aanbieding */}
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
        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Syne, sans-serif', color: 'var(--navy)' }}>Documenten</span>
        {documents.length > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {documents.length} document{documents.length !== 1 ? 'en' : ''}
          </span>
        )}
        {documents.some((d) => d.analysisStatus !== 'done') && documents.length > 0 && (
          <Button size="sm" variant="secondary" onClick={analyzeAll} style={{ marginLeft: 'auto' }}>
            Analyseer alle
          </Button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0 }}>
      {/* Left: Document list */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        {/* Upload zone */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>Type bij upload</label>
          <select
            value={uploadDocumentType}
            onChange={(e) => setUploadDocumentType(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: '8px 10px',
              borderRadius: 4,
              border: '1px solid var(--border)',
              fontSize: 12,
              fontFamily: 'IBM Plex Sans, sans-serif',
              background: 'white',
              maxWidth: 320,
            }}
          >
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileUpload(e.dataTransfer.files) }}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? 'var(--amber)' : 'var(--border)'}`,
            borderRadius: 4,
            padding: '28px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragOver ? '#FFFBEB' : 'white',
            transition: 'border-color 0.15s, background 0.15s',
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={dragOver ? 'var(--amber)' : '#D1D5DB'} strokeWidth="1.5" style={{ marginBottom: 10, display: 'block', margin: '0 auto 10px' }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            {uploading ? 'Uploaden...' : 'Sleep bestanden hierheen of klik om te uploaden'}
          </p>
          <p style={{ fontSize: 11, color: 'var(--muted)' }}>PDF, DOCX, XLSX, ZIP — max 50MB</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.xlsx,.zip"
            style={{ display: 'none' }}
            onChange={(e) => handleFileUpload(e.target.files)}
          />
        </div>

        {/* Document groups */}
        {Object.entries(groupedDocs).map(([type, docs]) => (
          <div key={type}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
              {DOC_TYPES.find((t) => t.value === type)?.label || type} ({docs.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDoc(selectedDoc?.id === doc.id ? null : doc)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    background: selectedDoc?.id === doc.id ? '#EFF6FF' : 'white',
                    border: `1px solid ${selectedDoc?.id === doc.id ? '#93C5FD' : 'var(--border)'}`,
                    borderRadius: 4,
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.fileName}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                      {formatFileSize(doc.fileSize)} · {formatDateTime(doc.uploadedAt)}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: ANALYSIS_STATUS_COLOR[doc.analysisStatus || 'pending'] }}>
                    {ANALYSIS_STATUS_LABEL[doc.analysisStatus || 'pending']}
                  </span>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {doc.fileUrl && (
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-blue)', textDecoration: 'none' }}
                        title="Openen in nieuw tabblad"
                      >
                        Bekijken
                      </a>
                    )}
                    {doc.analysisStatus !== 'done' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={analyzing.has(doc.id)}
                        onClick={(e) => { e.stopPropagation(); analyzeDocument(doc) }}
                      >
                        Analyseer
                      </Button>
                    )}
                    {doc.analysisStatus === 'done' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={clearingAnalysis.has(doc.id)}
                        onClick={(e) => { e.stopPropagation(); clearDocumentAnalysis(doc) }}
                      >
                        Analyse wissen
                      </Button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteDocument(doc) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2 }}
                      title="Verwijderen"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {documents.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--muted)' }}>
            <p style={{ fontSize: 13 }}>Nog geen documenten geüpload</p>
          </div>
        )}
      </div>

      {/* Right: Analysis panel */}
      {selectedDoc && selectedDoc.analysisStatus === 'done' && selectedDoc.analysisJson && (
        <div style={{
          width: 340,
          flexShrink: 0,
          background: 'white',
          border: '1px solid var(--border)',
          borderRadius: 4,
          overflow: 'auto',
          maxHeight: 600,
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Syne, sans-serif', color: 'var(--navy)' }}>AI Analyse</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button
                size="sm"
                variant="secondary"
                loading={clearingAnalysis.has(selectedDoc.id)}
                onClick={() => clearDocumentAnalysis(selectedDoc)}
              >
                Analyse wissen
              </Button>
            <button onClick={() => setSelectedDoc(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            </div>
          </div>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {selectedDoc.analysisSummary && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Samenvatting</div>
                <p style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6 }}>{selectedDoc.analysisSummary}</p>
              </div>
            )}
            {selectedDoc.analysisJson.key_requirements?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Kernvereisten</div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {selectedDoc.analysisJson.key_requirements.map((req: string, i: number) => (
                    <li key={i} style={{ fontSize: 12, color: 'var(--text-primary)', display: 'flex', gap: 6 }}>
                      <span style={{ color: '#059669', flexShrink: 0 }}>✓</span>
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {selectedDoc.analysisJson.award_criteria?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Gunningscriteria</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {selectedDoc.analysisJson.award_criteria.map((c: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-primary)' }}>
                      <span>{c.criterion}</span>
                      <span style={{ fontWeight: 700, color: 'var(--navy)', fontFamily: 'IBM Plex Mono, monospace' }}>{c.weight}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selectedDoc.analysisJson.risks?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Risico's</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {selectedDoc.analysisJson.risks.map((risk: string, i: number) => (
                    <div key={i} style={{ fontSize: 12, color: '#92400E', background: '#FFFBEB', padding: '5px 8px', borderRadius: 3, display: 'flex', gap: 6 }}>
                      <span>⚠</span>{risk}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
