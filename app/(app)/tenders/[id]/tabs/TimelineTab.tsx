'use client'

import { useState } from 'react'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { formatDateTime } from '@/lib/utils/format'

interface Activity {
  id: string
  userId: string | null
  activityType: string | null
  description: string | null
  createdAt: Date | null
}

interface Note {
  id: string
  authorId: string | null
  content: string | null
  noteType: string | null
  createdAt: Date | null
}

interface Props {
  tender: any
  activities: Activity[]
  notes: Note[]
  onActivitiesChange: (a: Activity[]) => void
  userMap: Record<string, any>
}

const NOTE_TYPE_LABELS: Record<string, string> = {
  internal: 'Intern',
  decision: 'Beslissing',
  risk: 'Risico',
  milestone: 'Mijlpaal',
}

const NOTE_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  internal: { bg: '#F3F4F6', text: 'var(--text-primary)' },
  decision: { bg: '#E0F2FE', text: '#075985' },
  risk: { bg: '#FFFBEB', text: '#92400E' },
  milestone: { bg: '#F3E8FF', text: '#6B21A8' },
}

const ACTIVITY_ICONS: Record<string, string> = {
  status_changed: '↻',
  document_uploaded: '↑',
  question_submitted: '?',
  section_approved: '✓',
  note_added: '📝',
  default: '•',
}

export default function TimelineTab({ tender, activities, notes, onActivitiesChange, userMap }: Props) {
  const { toast } = useToast()
  const [newNote, setNewNote] = useState({ content: '', noteType: 'internal' as const })
  const [addingNote, setAddingNote] = useState(false)

  const addNote = async () => {
    if (!newNote.content) return
    try {
      const res = await fetch(`/api/tenders/${tender.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newNote),
      })
      if (!res.ok) throw new Error()
      setNewNote({ content: '', noteType: 'internal' })
      setAddingNote(false)
      toast('Notitie toegevoegd', 'success')
      // Optimistically add to activities
      const newActivity: Activity = {
        id: Math.random().toString(36).slice(2),
        userId: null,
        activityType: 'note_added',
        description: newNote.content,
        createdAt: new Date(),
      }
      onActivitiesChange([newActivity, ...activities])
    } catch {
      toast('Toevoegen mislukt', 'error')
    }
  }

  return (
    <div style={{ maxWidth: 700, display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
      {/* Actiebalk –zelfde opmaak als andere tabs */}
      <div
        className="tender-tab-actions"
        style={{
          padding: '14px 0',
          marginBottom: 4,
          borderBottom: '1px solid #E5E7EB',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Syne, sans-serif', color: 'var(--navy)' }}>Tijdlijn</span>
      </div>
      {/* Add note */}
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 4, padding: 20 }}>
        <h3 style={{ fontSize: 14, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--navy)', marginBottom: 14 }}>
          Notitie toevoegen
        </h3>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          {(['internal', 'decision', 'risk', 'milestone'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setNewNote({ ...newNote, noteType: type as any })}
              style={{
                padding: '4px 10px',
                border: `1px solid ${newNote.noteType === type ? 'transparent' : 'var(--border)'}`,
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'IBM Plex Sans, sans-serif',
                background: newNote.noteType === type ? NOTE_TYPE_COLORS[type].bg : 'white',
                color: newNote.noteType === type ? NOTE_TYPE_COLORS[type].text : 'var(--muted)',
                transition: 'all 0.15s',
              }}
            >
              {NOTE_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
        <textarea
          value={newNote.content}
          onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
          placeholder="Schrijf een notitie..."
          rows={3}
          style={{
            width: '100%',
            padding: '8px 10px',
            border: '1px solid var(--border)',
            borderRadius: 4,
            fontSize: 13,
            fontFamily: 'IBM Plex Sans, sans-serif',
            color: 'var(--text-primary)',
            outline: 'none',
            resize: 'vertical',
            marginBottom: 10,
          }}
        />
        <Button size="sm" variant="amber" onClick={addNote} disabled={!newNote.content}>
          Notitie toevoegen
        </Button>
      </div>

      {/* Notes */}
      {notes.length > 0 && (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--off-white)' }}>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Syne, sans-serif', color: 'var(--navy)' }}>Notities</span>
          </div>
          {notes.map((note, i) => {
            const author = note.authorId ? userMap[note.authorId] : null
            const colors = NOTE_TYPE_COLORS[note.noteType || 'internal']
            return (
              <div
                key={note.id}
                style={{
                  padding: '14px 16px',
                  borderBottom: i < notes.length - 1 ? '1px solid #F3F4F6' : 'none',
                  display: 'flex',
                  gap: 12,
                  borderLeft: `3px solid ${colors.text}`,
                }}
              >
                <Avatar name={author?.name || 'Systeem'} size={28} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy)' }}>{author?.name || 'Systeem'}</span>
                    <Badge
                      value={NOTE_TYPE_LABELS[note.noteType || 'internal']}
                      bg={colors.bg}
                      color={colors.text}
                    />
                    <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>
                      {note.createdAt ? formatDateTime(note.createdAt) : ''}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{note.content}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Activity timeline */}
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--off-white)' }}>
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Syne, sans-serif', color: 'var(--navy)' }}>Activiteitslog</span>
        </div>
        {activities.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            Nog geen activiteit geregistreerd
          </div>
        ) : (
          activities.map((activity, i) => {
            const user = activity.userId ? userMap[activity.userId] : null
            const icon = ACTIVITY_ICONS[activity.activityType || 'default'] || ACTIVITY_ICONS.default
            return (
              <div
                key={activity.id}
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: '12px 16px',
                  borderBottom: i < activities.length - 1 ? '1px solid #F3F4F6' : 'none',
                  alignItems: 'flex-start',
                }}
              >
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: '#F3F4F6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  flexShrink: 0,
                }}>
                  {icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    {user && <strong>{user.name} </strong>}
                    {activity.description}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    {activity.createdAt ? formatDateTime(activity.createdAt) : ''}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
