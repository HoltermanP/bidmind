'use client'

import { useMemo, useRef, useState } from 'react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { formatDate } from '@/lib/utils/format'
import { displayTenderTitle } from '@/lib/tenders/resolve-project-title'

interface Question {
  id: string
  questionText: string | null
  rationale: string | null
  category: string | null
  priority: string | null
  status: string | null
  answerText: string | null
  aiGenerated: boolean | null
  submittedAt: Date | null
  answeredAt: Date | null
}

interface Props {
  tender: any
  questions: Question[]
  onQuestionsChange: (q: Question[]) => void
  documents: any[]
  onDocumentsChange: (docs: any[]) => void
}

const CATEGORIES = ['Technisch', 'Contractueel', 'Planning', 'Financieel', 'Juridisch']
const PRIORITIES = ['critical', 'high', 'medium', 'low']
const STATUS_LABELS: Record<string, string> = {
  draft: 'Concept',
  approved: 'Goedgekeurd',
  submitted: 'Ingediend',
  answered: 'Beantwoord',
  rejected: 'Afgekeurd',
}

/** Alleen deze statussen komen in het zichtbare NVI-document en in de PDF (na goedkeuring). */
const NVI_DOCUMENT_STATUSES = new Set(['approved', 'submitted', 'answered'])

function isInNviDocument(status: string | null | undefined): boolean {
  return NVI_DOCUMENT_STATUSES.has(status || '')
}

const POST_APPROVAL_STATUSES = new Set(['approved', 'submitted', 'answered'])
const PRIORITY_LABELS: Record<string, string> = {
  critical: 'Kritiek',
  high: 'Hoog',
  medium: 'Gemiddeld',
  low: 'Laag',
}

function priorityPillClass(priority: string | null | undefined): string {
  const p = priority || 'medium'
  const base = 'tender-nvi-priority-pill'
  if (p === 'critical') return `${base} tender-nvi-priority-pill--critical`
  if (p === 'high') return `${base} tender-nvi-priority-pill--high`
  if (p === 'low') return `${base} tender-nvi-priority-pill--low`
  return `${base} tender-nvi-priority-pill--medium`
}

function isPostApproval(status: string | null | undefined): boolean {
  return POST_APPROVAL_STATUSES.has(status || '')
}

function sortCategoryKeys(keys: string[]): string[] {
  const order = [...CATEGORIES, 'Overig']
  return [...keys].sort((a, b) => {
    const ia = order.indexOf(a)
    const ib = order.indexOf(b)
    const sa = ia === -1 ? 999 : ia
    const sb = ib === -1 ? 999 : ib
    if (sa !== sb) return sa - sb
    return a.localeCompare(b, 'nl')
  })
}

/** Afgekeurde vragen onderaan in de categorie. */
function sortCategoryQuestions(qs: Question[]): Question[] {
  return [...qs].sort((a, b) => {
    const ar = a.status === 'rejected' ? 1 : 0
    const br = b.status === 'rejected' ? 1 : 0
    if (ar !== br) return ar - br
    return 0
  })
}

interface NviDocSection {
  category: string
  items: { q: Question; num: number }[]
}

/**
 * Zelfde semantische opmaak als tenderanalyse (`article.tender-analysis-report` + typografie in globals).
 * Geen workflow-status in het document; prioriteit als gekleurde pill.
 */
function NviDocumentInner({
  tender,
  pdfSections,
  questionCount,
}: {
  tender: any
  pdfSections: NviDocSection[]
  questionCount: number
}) {
  return (
    <>
      <header className="tender-nvi-report-header">
        <p className="tender-nvi-report-kicker">Nota van Inlichtingen</p>
        <h1>NVI-vragen</h1>
        {tender.title ? <p className="tender-nvi-report-tender-title">{displayTenderTitle(tender.title)}</p> : null}
        {tender.referenceNumber ? <p>Kenmerk: {tender.referenceNumber}</p> : null}
        <p>Aangemaakt: {formatDate(new Date())}</p>
        {tender.deadlineQuestions ? <p>NVI-deadline: {formatDate(tender.deadlineQuestions)}</p> : null}
        <p>
          Totaal {questionCount} {questionCount === 1 ? 'vraag' : 'vragen'}
        </p>
      </header>

      {pdfSections.map(({ category, items }) => (
        <section key={category} className="tender-nvi-category-section">
          <h2>{category}</h2>
          {items.map(({ q, num }) => (
            <div key={q.id} className="tender-nvi-question-card">
              <h3>Vraag {num}</h3>
              <div className="tender-nvi-meta-row">
                <span className="tender-nvi-meta-label">Prioriteit</span>
                <span className={priorityPillClass(q.priority)}>
                  {PRIORITY_LABELS[q.priority || 'medium'] || q.priority}
                </span>
              </div>
              <p>{q.questionText || '—'}</p>
              <div className="tender-nvi-rationale">
                <p className="tender-nvi-rationale-heading">Toelichting</p>
                <p className="tender-nvi-rationale-text">
                  {q.rationale?.trim() ? q.rationale : '— Geen toelichting ingevuld.'}
                </p>
              </div>
              {q.status === 'answered' && q.answerText?.trim() ? (
                <div className="tender-nvi-answer-block">
                  <p className="tender-nvi-answer-heading">Antwoord (NVI)</p>
                  <p>{q.answerText}</p>
                </div>
              ) : null}
            </div>
          ))}
        </section>
      ))}
    </>
  )
}

export default function QuestionsTab({ tender, questions, onQuestionsChange, documents, onDocumentsChange }: Props) {
  const { toast } = useToast()
  const pdfPrintRef = useRef<HTMLDivElement>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [clearingNvi, setClearingNvi] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [expandedRationale, setExpandedRationale] = useState<Set<string>>(new Set())
  const [editingAnswer, setEditingAnswer] = useState<string | null>(null)
  const [answerText, setAnswerText] = useState('')
  const [newQ, setNewQ] = useState({ questionText: '', rationale: '', category: 'Technisch', priority: 'high' })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    questionText: '',
    rationale: '',
    category: 'Technisch',
    priority: 'high',
  })

  const generateQuestions = async () => {
    setGenerating(true)
    try {
      const res = await fetch(`/api/tenders/${tender.id}/questions/generate`, { method: 'POST' })
      if (!res.ok) throw new Error()
      const generated = await res.json()
      onQuestionsChange([...generated, ...questions])
      toast(`${generated.length} vragen gegenereerd`, 'success')
    } catch {
      toast('Genereren mislukt', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const addQuestion = async () => {
    if (!newQ.questionText) return
    try {
      const res = await fetch(`/api/tenders/${tender.id}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newQ),
      })
      if (!res.ok) throw new Error()
      const q = await res.json()
      onQuestionsChange([q, ...questions])
      setNewQ({ questionText: '', rationale: '', category: 'Technisch', priority: 'high' })
      setShowAddForm(false)
      toast('Vraag toegevoegd', 'success')
    } catch {
      toast('Toevoegen mislukt', 'error')
    }
  }

  const updateQuestion = async (id: string, updates: Partial<Question>, successToast?: string) => {
    try {
      const res = await fetch(`/api/tenders/${tender.id}/questions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      onQuestionsChange(questions.map((q) => (q.id === id ? updated : q)))
      if (successToast) toast(successToast, 'success')
    } catch {
      toast('Bijwerken mislukt', 'error')
    }
  }

  const startEdit = (q: Question) => {
    setEditingId(q.id)
    setEditForm({
      questionText: q.questionText || '',
      rationale: q.rationale || '',
      category: q.category || 'Overig',
      priority: q.priority || 'medium',
    })
  }

  const saveEdit = async (id: string) => {
    await updateQuestion(
      id,
      {
        questionText: editForm.questionText,
        rationale: editForm.rationale,
        category: editForm.category,
        priority: editForm.priority,
      },
      'Vraag bijgewerkt'
    )
    setEditingId(null)
  }

  const rejectQuestion = async (id: string) => {
    if (!confirm('Deze vraag afkeuren? Die komt niet in het NVI-document en je kunt hem later weer als concept heropenen.')) {
      return
    }
    await updateQuestion(id, { status: 'rejected' }, 'Vraag afgekeurd')
  }

  const nviDocumentCount = useMemo(
    () => documents.filter((d) => (d.documentType || 'eigen_upload') === 'nota_van_inlichtingen').length,
    [documents]
  )

  const clearAllNviData = async () => {
    if (questions.length === 0 && nviDocumentCount === 0) return
    if (
      !confirm(
        'Weet je zeker dat je alle NVI-vragen en alle Nota-van-Inlichtingen-documenten (NVI) voor deze tender wilt verwijderen? Dit kan niet ongedaan worden gemaakt.'
      )
    ) {
      return
    }
    setClearingNvi(true)
    try {
      const res = await fetch(`/api/tenders/${tender.id}/nvi-clear`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      onQuestionsChange([])
      onDocumentsChange(
        documents.filter((d) => (d.documentType || 'eigen_upload') !== 'nota_van_inlichtingen')
      )
      toast(
        `NVI-data gewist: ${data.deletedQuestions ?? 0} vraag/vragen, ${data.deletedDocuments ?? 0} document(en).`,
        'info'
      )
    } catch {
      toast('Wissen mislukt', 'error')
    } finally {
      setClearingNvi(false)
    }
  }

  const deleteQuestion = async (id: string) => {
    const q = questions.find((x) => x.id === id)
    if (q && isPostApproval(q.status)) {
      if (
        !confirm(
          'Weet je zeker dat je deze vraag wilt verwijderen? Deze vraag is al goedgekeurd of verder verwerkt (ingediend/beantwoord).'
        )
      ) {
        return
      }
    }
    try {
      const res = await fetch(`/api/tenders/${tender.id}/questions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      onQuestionsChange(questions.filter((x) => x.id !== id))
      toast('Vraag verwijderd', 'info')
    } catch {
      toast('Verwijderen mislukt', 'error')
    }
  }

  const groupedByCategory = questions.reduce<Record<string, Question[]>>((acc, q) => {
    const cat = q.category || 'Overig'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(q)
    return acc
  }, {})

  /** Vragen die in het NVI-document en de PDF staan (goedgekeurd of verder in de workflow). */
  const documentQuestions = useMemo(
    () => questions.filter((q) => isInNviDocument(q.status)),
    [questions]
  )

  const groupedByCategoryForDocument = useMemo(() => {
    const acc: Record<string, Question[]> = {}
    for (const q of documentQuestions) {
      const cat = q.category || 'Overig'
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(q)
    }
    return acc
  }, [documentQuestions])

  /** Alleen voor het rapport en PDF-export; live bij statuswijziging (bijv. goedkeuren). */
  const pdfSections = useMemo(() => {
    const keys = sortCategoryKeys(Object.keys(groupedByCategoryForDocument))
    let num = 0
    return keys.map((category) => ({
      category,
      items: (groupedByCategoryForDocument[category] || []).map((q) => ({ q, num: ++num })),
    }))
  }, [groupedByCategoryForDocument])

  const handleDownloadPdf = async () => {
    const el = pdfPrintRef.current
    if (!el) return
    setPdfLoading(true)
    try {
      const { default: html2pdf } = await import('html2pdf.js')
      const base = (
        'NVI-vragen-' + (tender.referenceNumber || displayTenderTitle(tender.title) || tender.id || 'tender')
      )
        .toString()
        .replace(/[^\w\d\-_.\s]+/g, '_')
        .trim()
        .slice(0, 80) || 'NVI-vragen'
      await html2pdf()
        .set({
          margin: [14, 12, 14, 12],
          filename: `${base}.pdf`,
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true },
          pagebreak: { mode: ['css', 'legacy'], avoid: ['.tender-nvi-question-card'] },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        } as never)
        .from(el)
        .save()
      toast('PDF gedownload', 'success')
    } catch {
      toast('PDF-export mislukt', 'error')
    } finally {
      setPdfLoading(false)
    }
  }

  const pdfIcon = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )

  const inputStyle = {
    width: '100%',
    padding: '7px 10px',
    border: '1px solid var(--border)',
    borderRadius: 4,
    fontSize: 13,
    fontFamily: 'IBM Plex Sans, sans-serif',
    color: 'var(--text-primary)',
    outline: 'none',
    background: 'white',
  }

  const generateIcon = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
  const addIcon = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>

  const trashIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )

  const editIcon = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0, maxWidth: '100%' }}>
      {/* Actiebalk – vaste positie, geen sticky, duidelijke scheiding van tab-balk */}
      <div
        className="tender-tab-actions"
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
          padding: '14px 0',
          marginBottom: 20,
          borderBottom: '1px solid #E5E7EB',
          minWidth: 0,
          maxWidth: '100%',
        }}
      >
        <Button
          variant="amber"
          loading={generating}
          onClick={generateQuestions}
          icon={generateIcon}
          title="Genereer vragen op basis van geüploade documenten"
          style={{ flexShrink: 0 }}
        >
          Genereer vragen
        </Button>
        <Button
          variant="secondary"
          onClick={() => setShowAddForm(!showAddForm)}
          icon={addIcon}
          style={{ flexShrink: 0 }}
        >
          Vraag toevoegen
        </Button>
        {documentQuestions.length > 0 && (
          <Button
            variant="secondary"
            loading={pdfLoading}
            onClick={handleDownloadPdf}
            icon={pdfIcon}
            title="Download goedgekeurde NVI-vragen als PDF"
            style={{ flexShrink: 0 }}
          >
            Download PDF
          </Button>
        )}
        {(questions.length > 0 || nviDocumentCount > 0) && (
          <Button
            variant="danger"
            loading={clearingNvi}
            onClick={clearAllNviData}
            icon={trashIcon}
            title="Verwijder alle NVI-vragen en alle NVI-documenten (Nota van Inlichtingen) bij deze tender"
            style={{ flexShrink: 0 }}
          >
            Alles wissen (NVI)
          </Button>
        )}
        {questions.length > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 'auto' }}>
            {questions.length} vragen · {documentQuestions.length} in NVI-document ·{' '}
            {questions.filter((q) => q.status === 'rejected').length} afgekeurd ·{' '}
            {questions.filter((q) => q.status === 'submitted').length} ingediend
          </span>
        )}
      </div>

      {/* NVI-document: alleen goedgekeurde (en verder); live bij statuswijziging */}
      {questions.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <p
            id="nvi-document-heading"
            style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}
          >
            <strong>NVI-document</strong> — zelfde opmaak als het tenderanalyse-rapport. Alleen vragen met status{' '}
            <em>goedgekeurd</em> of verder (ingediend, beantwoord) verschijnen hier en in de PDF. Concepten en afgekeurde
            vragen beheer je in de lijst hieronder.
          </p>
          {documentQuestions.length > 0 ? (
            <div ref={pdfPrintRef} className="tender-analysis-print-root">
              <article className="tender-analysis-report tender-nvi-report">
                <NviDocumentInner
                  tender={tender}
                  pdfSections={pdfSections}
                  questionCount={documentQuestions.length}
                />
              </article>
            </div>
          ) : (
            <div
              style={{
                padding: '20px 16px',
                border: '1px dashed var(--border)',
                borderRadius: 6,
                background: '#FAFAF8',
                fontSize: 13,
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              Nog geen vragen in het NVI-document. Keur een vraag goed om die hier direct te tonen; afgekeurde vragen
              blijven uit dit document.
            </div>
          )}
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 4, padding: 20 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Syne, sans-serif', color: 'var(--navy)', marginBottom: 14 }}>Nieuwe vraag</h4>
          <div style={{ display: 'grid', gap: 12 }}>
            <textarea
              value={newQ.questionText}
              onChange={(e) => setNewQ({ ...newQ, questionText: e.target.value })}
              placeholder="Vraagstelling..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
            <input
              value={newQ.rationale}
              onChange={(e) => setNewQ({ ...newQ, rationale: e.target.value })}
              placeholder="Rationale (waarom is deze vraag belangrijk?)"
              style={inputStyle}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <select value={newQ.category} onChange={(e) => setNewQ({ ...newQ, category: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <select value={newQ.priority} onChange={(e) => setNewQ({ ...newQ, priority: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button size="sm" variant="amber" onClick={addQuestion}>Toevoegen</Button>
              <Button size="sm" variant="secondary" onClick={() => setShowAddForm(false)}>Annuleren</Button>
            </div>
          </div>
        </div>
      )}

      {/* Questions by category */}
      {Object.keys(groupedByCategory).length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--muted)', background: 'white', border: '1px solid var(--border)', borderRadius: 4 }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1" style={{ marginBottom: 12, display: 'block', margin: '0 auto 12px' }}>
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Nog geen vragen</p>
          <p style={{ fontSize: 12, marginBottom: 20 }}>Genereer automatisch vragen of voeg ze handmatig toe</p>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, maxWidth: '100%', padding: '0 16px' }}>
            <Button
              variant="amber"
              loading={generating}
              onClick={generateQuestions}
              icon={generateIcon}
              title="Genereer vragen op basis van geüploade documenten"
              style={{ width: '100%', maxWidth: 320 }}
            >
              Genereer vragen
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowAddForm(!showAddForm)}
              icon={addIcon}
              style={{ width: '100%', maxWidth: 320 }}
            >
              Vraag toevoegen
            </Button>
          </div>
        </div>
      ) : (
        Object.entries(groupedByCategory).map(([category, qs]) => (
          <div key={category} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', background: '#FAFAF8', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Syne, sans-serif', color: 'var(--navy)' }}>{category}</span>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{qs.length} vragen</span>
            </div>
            <div>
              {sortCategoryQuestions(qs).map((q, i) => (
                <div
                  key={q.id}
                  style={{
                    borderBottom: i < qs.length - 1 ? '1px solid #F3F4F6' : 'none',
                    padding: '14px 16px',
                    background: q.status === 'rejected' ? '#FEF2F2' : undefined,
                    borderLeft: q.status === 'rejected' ? '3px solid #FECACA' : undefined,
                  }}
                >
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: 8 }}>
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: '8px 12px',
                            marginBottom: 4,
                          }}
                        >
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Prioriteit
                          </span>
                          <span className={priorityPillClass(q.priority)}>
                            {PRIORITY_LABELS[q.priority || 'medium'] || q.priority}
                          </span>
                        </div>
                        <p
                          style={{
                            fontSize: 11,
                            color: 'var(--muted)',
                            margin: 0,
                            lineHeight: 1.45,
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 8,
                          }}
                        >
                          <span>Status: {STATUS_LABELS[q.status || 'draft']}</span>
                          {q.aiGenerated ? (
                            <Badge value="AI" bg="#F3E8FF" color="#6B21A8" />
                          ) : null}
                        </p>
                      </div>
                      {editingId === q.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 4 }}>
                          <textarea
                            value={editForm.questionText}
                            onChange={(e) => setEditForm({ ...editForm, questionText: e.target.value })}
                            placeholder="Vraagstelling..."
                            rows={3}
                            style={{ ...inputStyle, resize: 'vertical' }}
                          />
                          <textarea
                            value={editForm.rationale}
                            onChange={(e) => setEditForm({ ...editForm, rationale: e.target.value })}
                            placeholder="Toelichting / rationale"
                            rows={2}
                            style={{ ...inputStyle, resize: 'vertical' }}
                          />
                          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <select
                              value={editForm.category}
                              onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                              style={{ ...inputStyle, cursor: 'pointer', maxWidth: 200 }}
                            >
                              {[...CATEGORIES, 'Overig'].map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                            <select
                              value={editForm.priority}
                              onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                              style={{ ...inputStyle, cursor: 'pointer', maxWidth: 160 }}
                            >
                              {PRIORITIES.map((p) => (
                                <option key={p} value={p}>
                                  {PRIORITY_LABELS[p]}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <Button size="sm" variant="amber" onClick={() => saveEdit(q.id)}>
                              Opslaan
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setEditingId(null)
                              }}
                            >
                              Annuleren
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p style={{ fontSize: 13, color: 'var(--navy)', lineHeight: 1.5, marginBottom: 4 }}>
                            {q.questionText}
                          </p>
                          {q.rationale && (
                            <div>
                              <button
                                type="button"
                                onClick={() => {
                                  const s = new Set(expandedRationale)
                                  s.has(q.id) ? s.delete(q.id) : s.add(q.id)
                                  setExpandedRationale(s)
                                }}
                                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 11, padding: 0 }}
                              >
                                {expandedRationale.has(q.id) ? '▲ Verberg rationale' : '▼ Toon rationale'}
                              </button>
                              {expandedRationale.has(q.id) && (
                                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 6, fontStyle: 'italic', background: '#F9FAFB', padding: '8px 10px', borderRadius: 3 }}>
                                  {q.rationale}
                                </p>
                              )}
                            </div>
                          )}
                        </>
                      )}
                      {q.status === 'answered' && q.answerText && (
                        <div style={{ marginTop: 10, background: '#F0FDF4', border: '1px solid #A7F3D0', borderRadius: 4, padding: '10px 12px' }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Antwoord</div>
                          <p style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>{q.answerText}</p>
                        </div>
                      )}
                      {editingAnswer === q.id && (
                        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <textarea
                            value={answerText}
                            onChange={(e) => setAnswerText(e.target.value)}
                            placeholder="Plak hier het antwoord uit de NVI..."
                            rows={3}
                            style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12, fontFamily: 'IBM Plex Sans, sans-serif', outline: 'none', resize: 'vertical' }}
                          />
                          <div style={{ display: 'flex', gap: 6 }}>
                            <Button size="sm" variant="amber" onClick={async () => {
                              await updateQuestion(q.id, { answerText, status: 'answered', answeredAt: new Date() })
                              setEditingAnswer(null)
                              setAnswerText('')
                              toast('Antwoord opgeslagen', 'success')
                            }}>Opslaan</Button>
                            <Button size="sm" variant="secondary" onClick={() => { setEditingAnswer(null); setAnswerText('') }}>Annuleren</Button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flexShrink: 0, alignItems: 'flex-start', justifyContent: 'flex-end', maxWidth: 280 }}>
                      {editingId !== q.id && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => startEdit(q)}
                          icon={editIcon}
                          title="Vraag bewerken"
                        >
                          Bewerken
                        </Button>
                      )}
                      {q.status === 'draft' && editingId !== q.id && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => updateQuestion(q.id, { status: 'approved' }, 'Vraag goedgekeurd')}
                            title="Goedkeuren — verschijnt in NVI-document"
                            style={{ background: '#F0FDF4', color: '#059669', border: '1px solid #A7F3D0' }}
                          >
                            Goedkeuren
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => rejectQuestion(q.id)}
                            title="Afkeuren — niet in NVI-document"
                          >
                            Afkeuren
                          </Button>
                        </>
                      )}
                      {q.status === 'rejected' && editingId !== q.id && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => updateQuestion(q.id, { status: 'draft' }, 'Terug naar concept')}
                          title="Opnieuw bewerken en beoordelen"
                        >
                          Heropenen
                        </Button>
                      )}
                      {q.status === 'approved' && editingId !== q.id && (
                        <Button
                          size="sm"
                          onClick={() => updateQuestion(q.id, { status: 'submitted', submittedAt: new Date() })}
                          title="Markeer als ingediend"
                          style={{ background: '#E0F2FE', color: '#075985', border: '1px solid #BAE6FD' }}
                        >
                          Ingediend
                        </Button>
                      )}
                      {q.status === 'submitted' && editingId !== q.id && (
                        <Button
                          size="sm"
                          onClick={() => { setEditingAnswer(q.id); setAnswerText(q.answerText || '') }}
                          title="Antwoord toevoegen"
                          style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}
                        >
                          + Antwoord
                        </Button>
                      )}
                      {editingId !== q.id && (
                        <button
                          type="button"
                          onClick={() => deleteQuestion(q.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: '5px 6px', borderRadius: 4 }}
                          title="Verwijderen"
                        >
                          {trashIcon}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
