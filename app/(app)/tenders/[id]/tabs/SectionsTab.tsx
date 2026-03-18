'use client'

import { useState, useRef, useEffect } from 'react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { formatDateTime } from '@/lib/utils/format'

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

export default function SectionsTab({ tender, sections, onSectionsChange, documents }: Props) {
  const { toast } = useToast()
  const [editingSection, setEditingSection] = useState<Section | null>(null)
  const [editorContent, setEditorContent] = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newSection, setNewSection] = useState({ title: '', sectionType: 'plan_van_aanpak' })
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const approved = sections.filter((s) => s.status === 'approved').length
  const total = sections.length

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
  }

  const saveSection = async () => {
    if (!editingSection) return
    setSaving(true)
    const wordCount = editorContent.trim().split(/\s+/).filter(Boolean).length
    try {
      const res = await fetch(`/api/tenders/${tender.id}/sections/${editingSection.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editorContent, wordCount, status: 'draft', lastEditedAt: new Date() }),
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
        body: JSON.stringify({ sectionType: editingSection.sectionType }),
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

  if (editingSection) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
        {/* Editor header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <button
            onClick={() => setEditingSection(null)}
            style={{ background: 'none', border: 'none', color: 'var(--slate-blue)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'IBM Plex Sans, sans-serif' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Terug naar secties
          </button>
          <span style={{ color: '#D1D5DB', fontSize: 13 }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>{editingSection.title}</span>
          <Badge
            value={STATUS_LABELS[editingSection.status || 'empty']}
            bg={STATUS_COLORS[editingSection.status || 'empty']?.bg}
            color={STATUS_COLORS[editingSection.status || 'empty']?.text}
          />
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button
              size="sm"
              variant="secondary"
              loading={generating}
              onClick={generateContent}
              icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>}
            >
              Genereer met AI
            </Button>
            <Button size="sm" variant="amber" loading={saving} onClick={saveSection}>Opslaan</Button>
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

        {/* Editor */}
        <div style={{ flex: 1, background: 'white', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', background: '#FAFAF8', display: 'flex', gap: 4 }}>
            {['**Vet**', '*Cursief*', '# Kop', '## Subkop', '- Lijst'].map((fmt) => (
              <button
                key={fmt}
                onClick={() => {
                  const textarea = textareaRef.current
                  if (!textarea) return
                  const start = textarea.selectionStart
                  const end = textarea.selectionEnd
                  const selected = editorContent.slice(start, end)
                  const prefix = fmt.split(selected.length > 0 ? selected : '')[0].replace(/[^*#\-\s]/g, '').trimEnd() || fmt.split(' ')[0]
                  const newContent = editorContent.slice(0, start) + prefix + ' ' + selected + editorContent.slice(end)
                  setEditorContent(newContent)
                }}
                style={{
                  background: 'none', border: '1px solid var(--border)', borderRadius: 3, padding: '3px 8px',
                  fontSize: 11, cursor: 'pointer', color: '#374151', fontFamily: 'IBM Plex Mono, monospace',
                }}
              >
                {fmt}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>
              {editorContent.trim().split(/\s+/).filter(Boolean).length} woorden
            </span>
          </div>
          <textarea
            ref={textareaRef}
            value={editorContent}
            onChange={(e) => setEditorContent(e.target.value)}
            placeholder="Begin met schrijven, of gebruik 'Genereer met AI'..."
            style={{
              flex: 1,
              padding: '16px 20px',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontSize: 13,
              fontFamily: 'IBM Plex Sans, sans-serif',
              lineHeight: 1.7,
              color: '#1A1A2E',
              background: 'white',
              minHeight: 400,
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0, maxWidth: '100%' }}>
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
        <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
