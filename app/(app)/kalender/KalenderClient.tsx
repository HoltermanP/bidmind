'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatDate, getDaysUntil } from '@/lib/utils/format'
import { displayTenderTitle } from '@/lib/tenders/resolve-project-title'

interface Tender {
  id: string
  title: string | null
  referenceNumber: string | null
  contractingAuthority: string | null
  deadlineQuestions: Date | null
  deadlineSubmission: Date | null
  status: string | null
}

interface Props {
  tenders: Tender[]
}

interface CalEvent {
  tenderId: string
  tenderTitle: string
  type: 'NVI' | 'Inschrijving'
  date: Date
  color: string
}

export default function KalenderClient({ tenders }: Props) {
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('list')
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const events: CalEvent[] = []
  for (const t of tenders) {
    if (t.deadlineQuestions) {
      events.push({ tenderId: t.id, tenderTitle: displayTenderTitle(t.title) || '—', type: 'NVI', date: new Date(t.deadlineQuestions), color: 'var(--amber)' })
    }
    if (t.deadlineSubmission) {
      events.push({ tenderId: t.id, tenderTitle: displayTenderTitle(t.title) || '—', type: 'Inschrijving', date: new Date(t.deadlineSubmission), color: '#DC2626' })
    }
  }

  const sortedEvents = [...events].sort((a, b) => a.date.getTime() - b.date.getTime())
  const upcomingEvents = sortedEvents.filter((e) => e.date >= new Date())

  // Calendar view
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const adjustedFirstDay = (firstDay + 6) % 7 // Monday first

  const monthNames = ['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December']
  const dayNames = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']

  const getEventsForDay = (day: number) => {
    return events.filter((e) => {
      return e.date.getFullYear() === year && e.date.getMonth() === month && e.date.getDate() === day
    })
  }

  return (
    <div className="app-page-padding">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>
            Kalender
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{upcomingEvents.length} aankomende deadlines</p>
        </div>
        <div style={{ display: 'flex', gap: 2, background: '#F3F4F6', borderRadius: 4, padding: 2 }}>
          {(['list', 'calendar'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: '6px 14px',
                borderRadius: 3,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'IBM Plex Sans, sans-serif',
                background: viewMode === mode ? 'white' : 'transparent',
                color: viewMode === mode ? 'var(--navy)' : 'var(--text-secondary)',
                boxShadow: viewMode === mode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {mode === 'list' ? 'Lijst' : 'Kalender'}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--amber)' }} />
          NVI Deadline
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#DC2626' }} />
          Inschrijvingsdeadline
        </div>
      </div>

      {viewMode === 'list' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {upcomingEvents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--muted)', background: 'white', border: '1px solid var(--border)', borderRadius: 4 }}>
              <p>Geen aankomende deadlines</p>
            </div>
          ) : (
            upcomingEvents.map((event, i) => {
              const daysLeft = getDaysUntil(event.date)
              const isUrgent = (daysLeft || 999) <= 7
              return (
                <Link key={`${event.tenderId}-${event.type}`} href={`/tenders/${event.tenderId}`} style={{ textDecoration: 'none' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      padding: '14px 20px',
                      background: 'white',
                      border: `1px solid ${isUrgent ? '#FECACA' : 'var(--border)'}`,
                      borderLeft: `4px solid ${event.color}`,
                      borderRadius: 4,
                      cursor: 'pointer',
                      transition: 'box-shadow 0.15s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
                  >
                    <div style={{ width: 52, textAlign: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Syne, sans-serif', color: isUrgent ? '#DC2626' : 'var(--navy)' }}>
                        {daysLeft === 0 ? '!' : daysLeft}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'IBM Plex Mono, monospace' }}>
                        {daysLeft === 0 ? 'VANDAAG' : 'DAGEN'}
                      </div>
                    </div>
                    <div style={{ width: 1, height: 40, background: 'var(--border)' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {event.tenderTitle}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        <span style={{ color: event.color, fontWeight: 600 }}>{event.type}</span>
                        {' — '}
                        {formatDate(event.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </div>
                </Link>
              )
            })
          )}
        </div>
      ) : (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          {/* Calendar header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <button
              onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', color: 'var(--text-primary)' }}
            >‹</button>
            <span style={{ fontSize: 16, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--navy)' }}>
              {monthNames[month]} {year}
            </span>
            <button
              onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', color: 'var(--text-primary)' }}
            >›</button>
          </div>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
            {dayNames.map((d) => (
              <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em' }}>
                {d}
              </div>
            ))}
          </div>
          {/* Calendar grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {Array.from({ length: adjustedFirstDay }, (_, i) => (
              <div key={`empty-${i}`} style={{ minHeight: 80, borderRight: '1px solid #F3F4F6', borderBottom: '1px solid #F3F4F6', background: '#FAFAF8' }} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1
              const dayEvents = getEventsForDay(day)
              const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year
              return (
                <div
                  key={day}
                  style={{
                    minHeight: 80,
                    padding: 6,
                    borderRight: '1px solid #F3F4F6',
                    borderBottom: '1px solid #F3F4F6',
                    background: isToday ? '#FFFBEB' : 'white',
                  }}
                >
                  <div style={{
                    fontSize: 12,
                    fontWeight: isToday ? 700 : 400,
                    color: isToday ? 'var(--amber)' : 'var(--text-primary)',
                    marginBottom: 4,
                    width: 22,
                    height: 22,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    background: isToday ? '#FEF3C7' : 'transparent',
                  }}>
                    {day}
                  </div>
                  {dayEvents.slice(0, 2).map((event, i) => (
                    <Link key={i} href={`/tenders/${event.tenderId}`} style={{ textDecoration: 'none' }}>
                      <div style={{
                        fontSize: 10,
                        background: event.color,
                        color: 'white',
                        borderRadius: 3,
                        padding: '2px 4px',
                        marginBottom: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontWeight: 600,
                      }}>
                        {event.type}: {event.tenderTitle.slice(0, 15)}...
                      </div>
                    </Link>
                  ))}
                  {dayEvents.length > 2 && (
                    <div style={{ fontSize: 9, color: 'var(--muted)' }}>+{dayEvents.length - 2} meer</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
