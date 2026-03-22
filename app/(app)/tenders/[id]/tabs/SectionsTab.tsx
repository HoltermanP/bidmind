'use client'

import { useState, useRef, type MouseEvent } from 'react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { formatDateTime } from '@/lib/utils/format'
import SectionRichTextEditor from '@/components/tenders/SectionRichTextEditor'
import { displayTenderTitle } from '@/lib/tenders/resolve-project-title'

interface Section {
  id: string
  title: string | null
  sectionType: string | null
  content: string | null
  status: string | null
  wordCount: number | null
  orderIndex: number | null
  aiGenerated: boolean | null
  lastEditedAt: Date | null
  lastEditedBy: string | null
}

interface Props {
  tender: any
  sections: Section[]
  onSectionsChange: (s: Section[]) => void
  documents: any[]
  onTenderUpdate: (updates: Record<string, unknown>) => void
}

const SECTION_TYPES = [
  { value: 'plan_van_aanpak', label: 'Plan van Aanpak' },
  { value: 'kwaliteit', label: 'Kwaliteitsborging' },
  { value: 'prijs_onderbouwing', label: 'Prijsonderbouwing' },
  { value: 'team_cv', label: "Team & CV's" },
  { value: 'referenties', label: 'Referenties' },
  { value: 'vca_veiligheid', label: 'VCA & Veiligheid' },
  { value: 'eigen_sectie', label: 'Eigen sectie' },
]

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  empty: { bg: '#F3F4F6', text: '#6B7280' },
  draft: { bg: '#FEF3C7', text: '#92400E' },
  in_review: { bg: '#E0F2FE', text: '#075985' },
  approved: { bg: '#D1FAE5', text: '#065F46' },
}
const STATUS_LABELS: Record<string, string> = {
  empty: 'Leeg',
  draft: 'Concept',
  in_review: 'Review',
  approved: 'Goedgekeurd',
}

/** Minimale tekstlengte voor review (gelijk aan API). */
const REVIEW_MIN_CHARS = 50

export default function SectionsTab({ tender, sections, onSectionsChange, documents, onTenderUpdate }: Props) {
  const { toast } = useToast()
  const reviewPrintRef = useRef<HTMLDivElement>(null)
  const [reviewPdfLoading, setReviewPdfLoading] = useState(false)
  const [reviewGenerating, setReviewGenerating] = useState(false)
  const [editingSection, setEditingSection] = useState<Section | null>(null)
  const [editorContent, setEditorContent] = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newSection, setNewSection] = useState({ title: '', sectionType: 'plan_van_aanpak' })
  const [editorTitle, setEditorTitle] = useState('')
  const [editorSectionType, setEditorSectionType] = useState('eigen_sectie')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const approved = sections.filter((s) => s.status === 'approved').length
  const total = sections.length

  const reviewStatus = tender.reviewReportStatus as string | undefined
  const reviewHtml = tender.reviewReportHtml as string | undefined
  const reviewGeneratedAt = tender.reviewReportGeneratedAt
  const reviewBusy = reviewGenerating || reviewStatus === 'processing'
  const isDirty = editingSection
    ? editorContent !== (editingSection.content || '') ||
      editorTitle !== (editingSection.title || '') ||
      editorSectionType !== (editingSection.sectionType || 'eigen_sectie')
    : false
  const hasReviewableContent =
    sections.some((s) => (s.content || '').trim().length >= REVIEW_MIN_CHARS) ||
    (Boolean(editingSection) && editorContent.trim().length >= REVIEW_MIN_CHARS)
  const hasAnalyzedDocuments = documents.some((d) => d.analysisStatus === 'done' && Boolean(d.analysisJson))

  const handleReviewGenerate = async () => {
    setReviewGenerating(true)
    try {
      if (editingSection && isDirty) {
        const wordCount = editorContent.trim().split(/\s+/).filter(Boolean).length
        const saveRes = await fetch(`/api/tenders/${tender.id}/sections/${editingSection.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: editorTitle.trim() || null,
            sectionType: editorSectionType,
            content: editorContent,
            wordCount,
            status: 'draft',
          }),
        })
        if (!saveRes.ok) {
          toast('Opslaan vóór review mislukt', 'error')
          return
        }
        const updated = await saveRes.json()
        onSectionsChange(sections.map((s) => (s.id === editingSection.id ? updated : s)))
        setEditingSection(updated)
      }

      const res = await fetch(`/api/tenders/${tender.id}/review-report`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        const sync = await fetch(`/api/tenders/${tender.id}`)
        if (sync.ok) onTenderUpdate(await sync.json())
        toast(body.error || 'Genereren mislukt', 'error')
        return
      }
      onTenderUpdate(body)
      toast('Reviewrapport gereed', 'success')
    } catch {
      const sync = await fetch(`/api/tenders/${tender.id}`)
      if (sync.ok) onTenderUpdate(await sync.json())
      toast('Genereren mislukt', 'error')
    } finally {
      setReviewGenerating(false)
    }
  }

  const handleReviewDownloadPdf = async () => {
    const el = reviewPrintRef.current
    if (!el) return
    setReviewPdfLoading(true)
    try {
      const { default: html2pdf } = await import('html2pdf.js')
      const base =
        (tender.referenceNumber || tender.title || 'review-rapport')
          .toString()
          .replace(/[^\w\d\-_.\s]+/g, '_')
          .trim()
          .slice(0, 80) || 'review-rapport'
      await html2pdf()
        .set({
          margin: [14, 12, 14, 12],
          filename: `${base}-review.pdf`,
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(el)
        .save()
    } catch {
      toast('PDF-export mislukt', 'error')
    } finally {
      setReviewPdfLoading(false)
    }
  }

  const addSection = async () => {
    try {
      const res = await fetch(`/api/tenders/${tender.id}/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newSection, orderIndex: sections.length }),
      })
      if (!res.ok) throw new Error()
      const s = await res.json()
      onSectionsChange([...sections, s])
      setNewSection({ title: '', sectionType: 'plan_van_aanpak' })
      setShowAddForm(false)
      toast('Sectie toegevoegd', 'success')
    } catch {
      toast('Toevoegen mislukt', 'error')
    }
  }

  const openEditor = (section: Section) => {
    setEditingSection(section)
    setEditorContent(section.content || '')
    setEditorTitle(section.title || '')
    setEditorSectionType(section.sectionType || 'eigen_sectie')
  }

  const deleteSection = async (section: Section, e?: MouseEvent) => {
    e?.stopPropagation()
    const label = section.title?.trim() || 'deze sectie'
    if (
      !confirm(
        `Weet je zeker dat je “${label}” wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`
      )
    ) {
      return
    }
    setDeletingId(section.id)
    try {
      const res = await fetch(`/api/tenders/${tender.id}/sections/${section.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      onSectionsChange(sections.filter((s) => s.id !== section.id))
      if (editingSection?.id === section.id) {
        setEditingSection(null)
        setEditorContent('')
        setEditorTitle('')
        setEditorSectionType('eigen_sectie')
      }
      toast('Sectie verwijderd', 'success')
    } catch {
      toast('Verwijderen mislukt', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  const saveSection = async () => {
    if (!editingSection) return
    setSaving(true)
    const wordCount = editorContent.trim().split(/\s+/).filter(Boolean).length
    try {
      const res = await fetch(`/api/tenders/${tender.id}/sections/${editingSection.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editorTitle.trim() || null,
          sectionType: editorSectionType,
          content: editorContent,
          wordCount,
          status: 'draft',
        }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      onSectionsChange(sections.map((s) => s.id === editingSection.id ? updated : s))
      setEditingSection(updated)
      toast('Opgeslagen', 'success')
    } catch {
      toast('Opslaan mislukt', 'error')
    } finally {
      setSaving(false)
    }
  }

  const generateContent = async () => {
    if (!editingSection) return
    setGenerating(true)
    try {
      const res = await fetch(`/api/tenders/${tender.id}/sections/${editingSection.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionType: editorSectionType }),
      })

      if (!res.ok) throw new Error()

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      setEditorContent('')

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') break
              try {
                const parsed = JSON.parse(data)
                if (parsed.choices?.[0]?.delta?.content) {
                  fullText += parsed.choices[0].delta.content
                  setEditorContent(fullText)
                }
              } catch {}
            }
          }
        }
      }

      toast('AI-tekst gegenereerd', 'success')
    } catch {
      toast('Genereren mislukt', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const downloadWord = async () => {
    setDownloading(true)
    try {
      const res = await fetch(`/api/tenders/${tender.id}/sections/export`)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Aanbieding_${(displayTenderTitle(tender.title) || 'document').replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').slice(0, 60)}.docx`
      a.click()
      URL.revokeObjectURL(url)
      toast('Word-document gedownload', 'success')
    } catch {
      toast('Download mislukt', 'error')
    } finally {
      setDownloading(false)
    }
  }

  const changeStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/tenders/${tender.id}/sections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      onSectionsChange(sections.map((s) => s.id === id ? updated : s))
      if (editingSection?.id === id) setEditingSection(updated)
    } catch {
      toast('Statuswijziging mislukt', 'error')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0, maxWidth: '100%' }}>
      {/* Reviewrapport — zelfde patroon als tab Tenderanalyse */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0, maxWidth: '100%' }}>
        <div
          className="tender-tab-actions"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            padding: '14px 0',
            marginBottom: 12,
            borderBottom: '1px solid #E5E7EB',
            minWidth: 0,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Syne, sans-serif', color: 'var(--navy)' }}>
            Reviewrapport
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1, minWidth: 120 }}>
            Kwaliteitsreview (Review Agent) van de sectieteksten t.o.v. criteria — HTML en PDF.
          </span>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleReviewGenerate}
            disabled={reviewBusy || !hasReviewableContent}
          >
            {reviewBusy ? 'Bezig…' : reviewHtml ? 'Review opnieuw genereren' : 'Review genereren'}
          </Button>
          {reviewHtml && (
            <Button size="sm" onClick={handleReviewDownloadPdf} disabled={reviewPdfLoading || reviewBusy}>
              {reviewPdfLoading ? 'PDF…' : 'Download PDF'}
            </Button>
          )}
        </div>

        {reviewStatus === 'failed' && !reviewBusy && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 6,
              background: 'var(--error-bg)',
              color: 'var(--error)',
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            De laatste generatie is mislukt. Controleer de AI-configuratie en probeer opnieuw.
          </div>
        )}

        {reviewBusy && (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
            De Review Agent werkt het rapport bij. Dit kan een minuut duren…
          </p>
        )}

        {!reviewHtml && !reviewBusy && reviewStatus !== 'processing' && (
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
            {hasReviewableContent ? (
              <>
                <strong style={{ color: 'var(--text-primary)' }}>Nog geen reviewrapport.</strong>{' '}
                {hasAnalyzedDocuments
                  ? 'Klik op Review genereren voor een beoordeling op volledigheid, criteria en verbeterpunten.'
                  : 'Tip: analyseer documenten onder Documenten (en optioneel de tenderanalyse) voor sterkere koppeling aan gunningscriteria; je kunt nu al genereren op basis van de sectieteksten.'}
              </>
            ) : (
              <>
                <strong style={{ color: 'var(--text-primary)' }}>Eerst inhoud in secties.</strong> Vul of genereer
                tekst in minstens één sectie (minimaal {REVIEW_MIN_CHARS} tekens opgeslagen of in de editor) voordat je
                review start.
              </>
            )}
          </div>
        )}

        {reviewHtml && (
          <div style={{ marginTop: 4, marginBottom: 8 }}>
            {reviewGeneratedAt && (
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
                Laatst gegenereerd: {formatDateTime(reviewGeneratedAt)}
              </p>
            )}
            <div ref={reviewPrintRef} className="tender-review-print-root">
              <div dangerouslySetInnerHTML={{ __html: reviewHtml }} />
            </div>
          </div>
        )}
      </div>

      {editingSection ? (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 0 }}>
          {/* Editor header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setEditingSection(null)}
              style={{ background: 'none', border: 'none', color: 'var(--slate-blue)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'IBM Plex Sans, sans-serif' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              Terug naar secties
            </button>
            <Badge
              value={STATUS_LABELS[editingSection.status || 'empty']}
              bg={STATUS_COLORS[editingSection.status || 'empty']?.bg}
              color={STATUS_COLORS[editingSection.status || 'empty']?.text}
            />
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button
                size="sm"
                variant="danger"
                loading={deletingId === editingSection.id}
                onClick={() => void deleteSection(editingSection)}
                icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>}
              >
                Verwijderen
              </Button>
              <Button
                size="sm"
                variant="secondary"
                loading={generating}
                onClick={generateContent}
                icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>}
              >
                Genereer met AI
              </Button>
              <Button size="sm" variant="amber" loading={saving} onClick={saveSection} disabled={!isDirty}>
                Opslaan
              </Button>
              {editingSection.status === 'draft' && (
                <Button size="sm" variant="secondary" onClick={() => changeStatus(editingSection.id, 'in_review')}>
                  Naar review
                </Button>
              )}
              {editingSection.status === 'in_review' && (
                <Button size="sm" variant="secondary" style={{ background: '#D1FAE5', color: '#065F46', border: '1px solid #A7F3D0' }} onClick={() => changeStatus(editingSection.id, 'approved')}>
                  ✓ Goedkeuren
                </Button>
              )}
            </div>
          </div>

          <div className="sections-editor-meta-grid">
            <div style={{ minWidth: 0 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Titel</label>
              <input
                value={editorTitle}
                onChange={(e) => setEditorTitle(e.target.value)}
                placeholder="Sectietitel"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  fontSize: 13,
                  fontFamily: 'IBM Plex Sans, sans-serif',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ minWidth: 0 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Type</label>
              <select
                value={editorSectionType}
                onChange={(e) => setEditorSectionType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  fontSize: 13,
                  fontFamily: 'IBM Plex Sans, sans-serif',
                  outline: 'none',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                }}
              >
                {SECTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <SectionRichTextEditor
            markdown={editorContent}
            onMarkdownChange={setEditorContent}
            sectionId={editingSection.id}
            generating={generating}
          />
        </div>
      ) : (
        <>
      {/* Actiebalk –zelfde opmaak als NVI Vragen en Documenten */}
      <div
        className="tender-tab-actions"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          padding: '14px 0',
          marginBottom: 20,
          borderBottom: '1px solid #E5E7EB',
          minWidth: 0,
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Voortgang aanbieding</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 180, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${total > 0 ? (approved / total) * 100 : 0}%`, height: '100%', background: '#059669', borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{approved}/{total} goedgekeurd</span>
          </div>
        </div>
        <div style={{ marginLeft: 'auto', flexShrink: 0, display: 'flex', gap: 8 }}>
          <Button
            size="sm"
            variant="secondary"
            loading={downloading}
            onClick={downloadWord}
            disabled={sections.length === 0}
            icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>}
          >
            Download als Word
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowAddForm(!showAddForm)}
            icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>}
          >
            Sectie toevoegen
          </Button>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 4, padding: 16, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Type</label>
            <select
              value={newSection.sectionType}
              onChange={(e) => {
                const type = e.target.value
                const label = SECTION_TYPES.find((t) => t.value === type)?.label || ''
                setNewSection({ sectionType: type, title: label })
              }}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 13, fontFamily: 'IBM Plex Sans, sans-serif', outline: 'none', cursor: 'pointer' }}
            >
              {SECTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Titel</label>
            <input
              value={newSection.title}
              onChange={(e) => setNewSection({ ...newSection, title: e.target.value })}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 13, fontFamily: 'IBM Plex Sans, sans-serif', outline: 'none' }}
            />
          </div>
          <Button size="sm" variant="amber" onClick={addSection}>Toevoegen</Button>
          <Button size="sm" variant="secondary" onClick={() => setShowAddForm(false)}>Annuleren</Button>
        </div>
      )}

      {/* Sections list */}
      {sections.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--muted)', background: 'white', border: '1px solid var(--border)', borderRadius: 4 }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1" style={{ display: 'block', margin: '0 auto 12px' }}>
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          <p style={{ fontWeight: 600, color: '#374151', marginBottom: 4 }}>Geen secties aangemaakt</p>
          <p style={{ fontSize: 12 }}>Voeg secties toe voor de aanbieding</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {sections.map((section) => (
            <div
              key={section.id}
              style={{
                background: 'white',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
                transition: 'box-shadow 0.15s',
              }}
              onClick={() => openEditor(section)}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
            >
              <div style={{
                width: 4,
                alignSelf: 'stretch',
                background: STATUS_COLORS[section.status || 'empty']?.bg === '#D1FAE5' ? '#059669' : STATUS_COLORS[section.status || 'empty']?.bg,
                borderRadius: 2,
                flexShrink: 0,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>{section.title}</span>
                  <Badge
                    value={STATUS_LABELS[section.status || 'empty']}
                    bg={STATUS_COLORS[section.status || 'empty']?.bg}
                    color={STATUS_COLORS[section.status || 'empty']?.text}
                    size="sm"
                  />
                  {section.aiGenerated && <Badge value="AI" bg="#F3E8FF" color="#6B21A8" size="sm" />}
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--muted)' }}>
                  <span>{section.wordCount || 0} woorden</span>
                  {section.lastEditedAt && <span>Bewerkt {formatDateTime(section.lastEditedAt)}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <Button
                  size="sm"
                  variant="danger"
                  loading={deletingId === section.id}
                  onClick={(e) => void deleteSection(section, e)}
                  icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>}
                >
                  Verwijderen
                </Button>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}
        </>
      )}
    </div>
  )
}
