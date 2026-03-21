'use client'

import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import { useToast } from '@/components/ui/Toast'
import { formatDate, formatDateTime, formatCurrency, getDaysUntil, STATUS_LABELS } from '@/lib/utils/format'
import OverviewTab from './tabs/OverviewTab'
import AnalysisTab from './tabs/AnalysisTab'
import DocumentsTab from './tabs/DocumentsTab'
import QuestionsTab from './tabs/QuestionsTab'
import SectionsTab from './tabs/SectionsTab'
import TimelineTab from './tabs/TimelineTab'

interface Props {
  tender: any
  documents: any[]
  questions: any[]
  sections: any[]
  activities: any[]
  notes: any[]
  userMap: Record<string, any>
  allUsers: any[]
}

const TABS = [
  { id: 'overview', label: 'Overzicht' },
  { id: 'documents', label: 'Documenten' },
  { id: 'analysis', label: 'Tenderanalyse' },
  { id: 'questions', label: 'NVI Vragen' },
  { id: 'sections', label: 'Aanbieding' },
  { id: 'timeline', label: 'Tijdlijn' },
]

const STATUS_OPTIONS = ['new', 'qualifying', 'analyzing', 'writing', 'review', 'submitted', 'won', 'lost', 'withdrawn']

export default function TenderDetailClient({ tender: initialTender, documents: initialDocs, questions: initialQuestions, sections: initialSections, activities: initialActivities, notes: initialNotes, userMap, allUsers }: Props) {
  const [activeTab, setActiveTab] = useState('overview')
  const [tabIndicator, setTabIndicator] = useState<{ left: number; width: number }>({ left: 0, width: 0 })
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [tender, setTender] = useState(initialTender)
  const [documents, setDocuments] = useState(initialDocs)
  const [questions, setQuestions] = useState(initialQuestions)
  const [sections, setSections] = useState(initialSections)
  const [activities, setActivities] = useState(initialActivities)
  const { toast } = useToast()
  const router = useRouter()

  useLayoutEffect(() => {
    const el = tabRefs.current[activeTab]
    if (el) {
      setTabIndicator({ left: el.offsetLeft, width: el.offsetWidth })
    }
  }, [activeTab])

  const updateTabIndicator = () => {
    const el = tabRefs.current[activeTab]
    if (el) setTabIndicator({ left: el.offsetLeft, width: el.offsetWidth })
  }

  useEffect(() => {
    window.addEventListener('resize', updateTabIndicator)
    return () => window.removeEventListener('resize', updateTabIndicator)
  }, [activeTab])

  const patchTender = async (updates: Record<string, any>) => {
    setTender({ ...tender, ...updates })
    try {
      const res = await fetch(`/api/tenders/${tender.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error()
    } catch {
      toast('Opslaan mislukt', 'error')
      setTender(initialTender)
    }
  }

  const daysToNVI = getDaysUntil(tender.deadlineQuestions)
  const daysToSubmission = getDaysUntil(tender.deadlineSubmission)
  const manager = tender.tenderManagerId ? userMap[tender.tenderManagerId] : null
  const teamMembers = (tender.teamMemberIds || []).map((id: string) => userMap[id]).filter(Boolean)

  const approvedSections = sections.filter((s: any) => s.status === 'approved').length

  return (
    <div
      className="tender-detail-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* Header – geen sticky/z-index zodat body-knoppen nooit bedekt worden */}
      <div
        className="tender-detail-header-inner"
        style={{
        background: 'white',
        borderBottom: '1px solid var(--border)',
        padding: '0 32px',
        flexShrink: 0,
        minWidth: 0,
      }}
      >
        {/* Top row – minder verticale ruimte zodat kop omhoog komt */}
        <div style={{ paddingTop: 4, paddingBottom: 6, display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <Link
            href="/tenders"
            style={{ color: 'var(--slate-blue)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginTop: 2, flexShrink: 0 }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Tenders
          </Link>

          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 2 }}>
              <h1 style={{
                fontSize: 20,
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                color: 'var(--navy)',
                lineHeight: 1.2,
                wordBreak: 'break-word',
                maxWidth: '100%',
              }}>
                {tender.title}
              </h1>
              {tender.referenceNumber && (
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--muted)', background: '#F3F4F6', padding: '2px 6px', borderRadius: 3 }}>
                  {tender.referenceNumber}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {/* Status dropdown */}
              <select
                value={tender.status}
                onChange={(e) => patchTender({ status: e.target.value })}
                style={{
                  padding: '3px 8px',
                  border: '1px solid var(--border)',
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'IBM Plex Sans, sans-serif',
                  cursor: 'pointer',
                  outline: 'none',
                  background: 'white',
                  color: 'var(--text-primary)',
                }}
              >
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>

              {/* Go/No-Go */}
              <div style={{ display: 'flex', gap: 2 }}>
                {(['pending', 'go', 'no_go'] as const).map((val) => {
                  const colors = {
                    pending: { active: '#F3F4F6', text: 'var(--text-primary)' },
                    go: { active: '#D1FAE5', text: '#065F46' },
                    no_go: { active: '#FEE2E2', text: '#991B1B' },
                  }
                  const labels = { pending: 'Afwachten', go: 'Go', no_go: 'No Go' }
                  const isActive = tender.goNoGo === val
                  return (
                    <button
                      key={val}
                      onClick={() => patchTender({ goNoGo: val })}
                      style={{
                        padding: '3px 10px',
                        border: `1px solid ${isActive ? 'transparent' : 'var(--border)'}`,
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'IBM Plex Sans, sans-serif',
                        background: isActive ? colors[val].active : 'white',
                        color: isActive ? colors[val].text : 'var(--muted)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {labels[val]}
                    </button>
                  )
                })}
              </div>

              {/* Deadline chips */}
              {daysToNVI !== null && daysToNVI >= 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: daysToNVI <= 3 ? '#FEF2F2' : '#FFFBEB',
                  color: daysToNVI <= 3 ? '#DC2626' : '#B45309',
                  padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  NVI: {daysToNVI === 0 ? 'Vandaag' : `${daysToNVI}d`}
                </div>
              )}
              {daysToSubmission !== null && daysToSubmission >= 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: daysToSubmission <= 7 ? '#FEF2F2' : '#F0FDF4',
                  color: daysToSubmission <= 7 ? '#DC2626' : '#065F46',
                  padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  Inschrijving: {daysToSubmission === 0 ? 'Vandaag' : `${daysToSubmission}d`}
                </div>
              )}

              {/* Win probability */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Win%:</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={tender.winProbability || 0}
                  onChange={(e) => setTender({ ...tender, winProbability: parseInt(e.target.value) })}
                  onMouseUp={(e) => patchTender({ winProbability: parseInt((e.target as HTMLInputElement).value) })}
                  style={{ width: 80, cursor: 'pointer', accentColor: '#F5A623', flexShrink: 0 }}
                />
                <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', color: 'var(--navy)', minWidth: 28 }}>
                  {tender.winProbability || 0}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs – duidelijke onderrand, body valt niet onder dit blok */}
        <div style={{ position: 'relative', display: 'flex', gap: 0, flexShrink: 0, overflowX: 'auto', overflowY: 'hidden', paddingBottom: 10 }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              ref={(el) => { tabRefs.current[tab.id] = el }}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '6px 14px',
                background: 'none',
                border: 'none',
                borderBottom: '2px solid transparent',
                color: activeTab === tab.id ? 'var(--navy)' : 'var(--text-secondary)',
                fontFamily: 'IBM Plex Sans, sans-serif',
                fontSize: 13,
                fontWeight: activeTab === tab.id ? 600 : 400,
                cursor: 'pointer',
                transition: 'color 0.15s',
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
              {tab.id === 'documents' && documents.length > 0 && (
                <span style={{ marginLeft: 6, background: '#F3F4F6', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>{documents.length}</span>
              )}
              {tab.id === 'questions' && questions.length > 0 && (
                <span style={{ marginLeft: 6, background: '#F3F4F6', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>{questions.length}</span>
              )}
              {tab.id === 'sections' && sections.length > 0 && (
                <span style={{ marginLeft: 6, background: approvedSections > 0 ? '#D1FAE5' : '#F3F4F6', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700, color: approvedSections > 0 ? '#065F46' : 'var(--text-secondary)' }}>{approvedSections}/{sections.length}</span>
              )}
            </button>
          ))}
          {/* Tab indicator – exacte breedte onder actieve tab */}
          {tabIndicator.width > 0 && (
            <div
              style={{
                position: 'absolute',
                left: tabIndicator.left,
                bottom: 0,
                width: tabIndicator.width,
                height: 2,
                background: '#F5A623',
                pointerEvents: 'none',
              }}
            />
          )}
        </div>
      </div>

      {/* Main content – alleen hier scrollt; header blijft in flow */}
      <div className="tender-detail-layout" style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {/* Left: Tab content – voldoende ruimte onder tab-balk */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '24px 32px 32px', boxSizing: 'border-box' }} className="tender-tab-scroll">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0 }}
            >
              {activeTab === 'overview' && (
                <OverviewTab tender={tender} onUpdate={patchTender} allUsers={allUsers} userMap={userMap} />
              )}
              {activeTab === 'analysis' && (
                <AnalysisTab
                  tender={tender}
                  documents={documents}
                  onTenderUpdate={(updates) => setTender((prev: any) => ({ ...prev, ...updates }))}
                />
              )}
              {activeTab === 'documents' && (
                <DocumentsTab tender={tender} documents={documents} onDocumentsChange={setDocuments} userMap={userMap} />
              )}
              {activeTab === 'questions' && (
                <QuestionsTab tender={tender} questions={questions} onQuestionsChange={setQuestions} documents={documents} />
              )}
              {activeTab === 'sections' && (
                <SectionsTab tender={tender} sections={sections} onSectionsChange={setSections} documents={documents} />
              )}
              {activeTab === 'timeline' && (
                <TimelineTab tender={tender} activities={activities} notes={initialNotes} onActivitiesChange={setActivities} userMap={userMap} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right: Sidebar */}
        <div
          className="tender-detail-sidebar"
          style={{
          width: 280,
          borderLeft: '1px solid var(--border)',
          background: 'white',
          overflow: 'auto',
          flexShrink: 0,
          padding: '20px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
        >
          {/* Manager */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Tendermanager</div>
            {manager ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar name={manager.name} src={manager.avatarUrl} size={36} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>{manager.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{manager.email}</div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Niet toegewezen</div>
            )}
          </div>

          {/* Team */}
          {teamMembers.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Team</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {teamMembers.map((member: any) => (
                  <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar name={member.name} src={member.avatarUrl} size={24} />
                    <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{member.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Key dates */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Sleuteldatums</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Publicatie', date: tender.publicationDate },
                { label: 'NVI deadline', date: tender.deadlineQuestions },
                { label: 'Inschrijvingsdeadline', date: tender.deadlineSubmission },
              ].map(({ label, date }) => date && (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--navy)', fontFamily: 'IBM Plex Mono, monospace' }}>
                    {formatDate(date)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick stats */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Statistieken</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Documenten', value: documents.length },
                { label: 'Vragen', value: questions.length },
                { label: 'Secties', value: sections.length },
                { label: 'Goedgekeurd', value: approvedSections },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: '#F9FAFB', borderRadius: 4, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Syne, sans-serif', color: 'var(--navy)' }}>{value}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Risks from AI */}
          {documents.some((d: any) => d.analysisJson?.risks?.length > 0) && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Risico-indicatoren</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {documents
                  .flatMap((d: any) => d.analysisJson?.risks || [])
                  .slice(0, 4)
                  .map((risk: string, i: number) => (
                    <div
                      key={i}
                      style={{
                        fontSize: 11,
                        color: '#92400E',
                        background: '#FFFBEB',
                        border: '1px solid #FDE68A',
                        borderRadius: 4,
                        padding: '6px 8px',
                        lineHeight: 1.4,
                      }}
                    >
                      ⚠ {risk}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Recent activity */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Recente activiteit</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activities.slice(0, 5).map((act: any) => {
                const user = act.userId ? userMap[act.userId] : null
                return (
                  <div key={act.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <Avatar name={user?.name || 'S'} size={20} />
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.4 }}>{act.description}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)' }}>{act.createdAt ? formatDateTime(act.createdAt) : ''}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
