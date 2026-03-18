'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { formatDate } from '@/lib/utils/format'

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
}

const CATEGORIES = ['Technisch', 'Contractueel', 'Planning', 'Financieel', 'Juridisch']
const PRIORITIES = ['critical', 'high', 'medium', 'low']
const STATUS_OPTIONS = ['draft', 'approved', 'submitted', 'answered']
const STATUS_LABELS: Record<string, string> = { draft: 'Concept', approved: 'Goedgekeurd', submitted: 'Ingediend', answered: 'Beantwoord' }

export default function QuestionsTab({ tender, questions, onQuestionsChange, documents }: Props) {
  const { toast } = useToast()
  const [generating, setGenerating] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [expandedRationale, setExpandedRationale] = useState<Set<string>>(new Set())
  const [editingAnswer, setEditingAnswer] = useState<string | null>(null)
  const [answerText, setAnswerText] = useState('')
  const [newQ, setNewQ] = useState({ questionText: '', rationale: '', category: 'Technisch', priority: 'high' })

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

  const updateQuestion = async (id: string, updates: Partial<Question>) => {
    try {
      const res = await fetch(`/api/tenders/${tender.id}/questions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      onQuestionsChange(questions.map((q) => q.id === id ? updated : q))
    } catch {
      toast('Bijwerken mislukt', 'error')
    }
  }

  const deleteQuestion = async (id: string) => {
    try {
      await fetch(`/api/tenders/${tender.id}/questions/${id}`, { method: 'DELETE' })
      onQuestionsChange(questions.filter((q) => q.id !== id))
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
        {questions.length > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 'auto' }}>
            {questions.length} vragen · {questions.filter((q) => q.status === 'submitted').length} ingediend
          </span>
        )}
      </div>

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
              {qs.map((q, i) => (
                <div key={q.id} style={{ borderBottom: i < qs.length - 1 ? '1px solid #F3F4F6' : 'none', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                        <Badge variant="priority" value={q.priority || 'medium'} />
                        <Badge
                          value={STATUS_LABELS[q.status || 'draft']}
                          bg={q.status === 'answered' ? '#D1FAE5' : q.status === 'submitted' ? '#E0F2FE' : '#F3F4F6'}
                          color={q.status === 'answered' ? '#065F46' : q.status === 'submitted' ? '#075985' : 'var(--text-primary)'}
                        />
                        {q.aiGenerated && (
                          <Badge value="AI" bg="#F3E8FF" color="#6B21A8" />
                        )}
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--navy)', lineHeight: 1.5, marginBottom: 4 }}>
                        {q.questionText}
                      </p>
                      {q.rationale && (
                        <div>
                          <button
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

                    {/* Acties – Button component voor consistente stijl en betere klikbaarheid */}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'flex-start' }}>
                      {q.status === 'draft' && (
                        <Button
                          size="sm"
                          onClick={() => updateQuestion(q.id, { status: 'approved' })}
                          title="Goedkeuren"
                          style={{ background: '#F0FDF4', color: '#059669', border: '1px solid #A7F3D0' }}
                        >
                          Goedkeuren
                        </Button>
                      )}
                      {q.status === 'approved' && (
                        <Button
                          size="sm"
                          onClick={() => updateQuestion(q.id, { status: 'submitted', submittedAt: new Date() })}
                          title="Markeer als ingediend"
                          style={{ background: '#E0F2FE', color: '#075985', border: '1px solid #BAE6FD' }}
                        >
                          Ingediend
                        </Button>
                      )}
                      {q.status === 'submitted' && (
                        <Button
                          size="sm"
                          onClick={() => { setEditingAnswer(q.id); setAnswerText(q.answerText || '') }}
                          title="Antwoord toevoegen"
                          style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}
                        >
                          + Antwoord
                        </Button>
                      )}
                      <button
                        onClick={() => deleteQuestion(q.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: '5px 6px', borderRadius: 4 }}
                        title="Verwijderen"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
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
