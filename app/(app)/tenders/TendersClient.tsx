'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Badge from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import { formatDate, formatCurrency, getDaysUntil } from '@/lib/utils/format'
import { useToast } from '@/components/ui/Toast'

export interface TenderNedItem {
  publicatieId: string
  title: string
  referenceNumber: string | null
  contractingAuthority: string | null
  publicationDate: string | null
  deadlineSubmission: string | null
  procedureType: string | null
  typeOpdracht: string | null
  description: string | null
  tendernetUrl: string | null
}

interface Tender {
  id: string
  title: string | null
  referenceNumber: string | null
  contractingAuthority: string | null
  deadlineSubmission: Date | null
  deadlineQuestions: Date | null
  estimatedValue: string | null
  status: string | null
  goNoGo: string | null
  winProbability: number | null
  tenderManagerId: string | null
  teamMemberIds: string[] | null
  createdAt: Date | null
  updatedAt: Date | null
}

interface User {
  id: string
  name: string | null
  email: string | null
  avatarUrl: string | null
  role: string | null
}

interface Props {
  initialTenders: Tender[]
  userMap: Record<string, User>
  allUsers: User[]
  initialSearchParams: Record<string, string>
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Alle statussen' },
  { value: 'new', label: 'Nieuw' },
  { value: 'qualifying', label: 'Kwalificatie' },
  { value: 'analyzing', label: 'Analyse' },
  { value: 'writing', label: 'Schrijven' },
  { value: 'review', label: 'Review' },
  { value: 'submitted', label: 'Ingediend' },
  { value: 'won', label: 'Gewonnen' },
  { value: 'lost', label: 'Verloren' },
]

export default function TendersClient({ initialTenders, userMap, allUsers, initialSearchParams }: Props) {
  const [search, setSearch] = useState(initialSearchParams.q || '')
  const [statusFilter, setStatusFilter] = useState(initialSearchParams.status || 'all')
  const [goNoGoFilter, setGoNoGoFilter] = useState(initialSearchParams.gonogo || 'all')
  const [sortBy, setSortBy] = useState<'deadline' | 'updated' | 'value'>('updated')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [showCreatePanel, setShowCreatePanel] = useState(false)
  const [showTenderNedPanel, setShowTenderNedPanel] = useState(false)
  const [tenderNedData, setTenderNedData] = useState<{
    content: TenderNedItem[]
    totalElements: number
  } | null>(null)
  const [tenderNedLoading, setTenderNedLoading] = useState(false)
  const [importingId, setImportingId] = useState<string | null>(null)
  const [tenderNedSearch, setTenderNedSearch] = useState('')
  const [tenderNedProcedureFilter, setTenderNedProcedureFilter] = useState<string>('all')
  const [tenderNedSortBy, setTenderNedSortBy] = useState<'title' | 'authority' | 'deadline' | 'procedure'>('deadline')
  const [tenderNedSortDir, setTenderNedSortDir] = useState<'asc' | 'desc'>('asc')
  const [tenderNedViewPage, setTenderNedViewPage] = useState(0)
  const TENDER_NED_PAGE_SIZE = 20
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  const handleDeleteTender = useCallback(async (e: React.MouseEvent, tenderId: string, tenderTitle: string) => {
    e.stopPropagation()
    if (!confirm(`Weet je zeker dat je "${tenderTitle || 'deze tender'}" wilt verwijderen? Alle acties, documenten, notities, vragen en secties worden permanent verwijderd.`)) return
    setDeletingId(tenderId)
    try {
      const res = await fetch(`/api/tenders/${tenderId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? 'Verwijderen mislukt')
      }
      toast('Tender en alle bijbehorende gegevens verwijderd', 'success')
      router.refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Verwijderen mislukt', 'error')
    } finally {
      setDeletingId(null)
    }
  }, [router, toast])

  const loadTenderNed = useCallback(async () => {
    setTenderNedLoading(true)
    try {
      const res = await fetch('/api/tenderned/publicaties?all=true')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const msg = body?.error || res.statusText || 'Ophalen mislukt'
        throw new Error(msg)
      }
      const data = await res.json()
      setTenderNedData({
        content: data.content,
        totalElements: data.totalElements,
      })
      setTenderNedViewPage(0)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'TenderNed aankondigingen konden niet worden opgehaald'
      toast(message, 'error')
    } finally {
      setTenderNedLoading(false)
    }
  }, [toast])

  const openTenderNed = useCallback(() => {
    setShowTenderNedPanel(true)
    setTenderNedData(null)
    setTenderNedSearch('')
    setTenderNedProcedureFilter('all')
    setTenderNedSortBy('deadline')
    setTenderNedSortDir('asc')
    setTenderNedViewPage(0)
    loadTenderNed()
  }, [loadTenderNed])

  const tenderNedProcedureOptions = useMemo(() => {
    if (!tenderNedData?.content?.length) return []
    const set = new Set<string>()
    tenderNedData.content.forEach((item) => {
      if (item.procedureType?.trim()) set.add(item.procedureType.trim())
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [tenderNedData?.content])

  const tenderNedFilteredAndSorted = useMemo(() => {
    if (!tenderNedData?.content) return []
    let list = [...tenderNedData.content]
    if (tenderNedSearch.trim()) {
      const q = tenderNedSearch.toLowerCase().trim()
      list = list.filter(
        (item) =>
          item.title?.toLowerCase().includes(q) ||
          item.referenceNumber?.toLowerCase().includes(q) ||
          item.contractingAuthority?.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q)
      )
    }
    if (tenderNedProcedureFilter !== 'all') {
      list = list.filter((item) => (item.procedureType?.trim() ?? '') === tenderNedProcedureFilter)
    }
    list.sort((a, b) => {
      let cmp = 0
      if (tenderNedSortBy === 'title') {
        cmp = (a.title ?? '').localeCompare(b.title ?? '', 'nl')
      } else if (tenderNedSortBy === 'authority') {
        cmp = (a.contractingAuthority ?? '').localeCompare(b.contractingAuthority ?? '', 'nl')
      } else if (tenderNedSortBy === 'deadline') {
        const da = a.deadlineSubmission ? new Date(a.deadlineSubmission).getTime() : 0
        const db = b.deadlineSubmission ? new Date(b.deadlineSubmission).getTime() : 0
        cmp = da - db
      } else {
        cmp = (a.procedureType ?? '').localeCompare(b.procedureType ?? '', 'nl')
      }
      return tenderNedSortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [tenderNedData?.content, tenderNedSearch, tenderNedProcedureFilter, tenderNedSortBy, tenderNedSortDir])

  useEffect(() => {
    setTenderNedViewPage(0)
  }, [tenderNedSearch, tenderNedProcedureFilter])

  const tenderNedTotalFilteredPages = Math.max(1, Math.ceil(tenderNedFilteredAndSorted.length / TENDER_NED_PAGE_SIZE))
  useEffect(() => {
    if (tenderNedViewPage >= tenderNedTotalFilteredPages) {
      setTenderNedViewPage(Math.max(0, tenderNedTotalFilteredPages - 1))
    }
  }, [tenderNedTotalFilteredPages, tenderNedViewPage])
  const tenderNedCurrentPage = Math.min(tenderNedViewPage, tenderNedTotalFilteredPages - 1)
  const tenderNedPageItems = useMemo(
    () =>
      tenderNedFilteredAndSorted.slice(
        tenderNedCurrentPage * TENDER_NED_PAGE_SIZE,
        (tenderNedCurrentPage + 1) * TENDER_NED_PAGE_SIZE
      ),
    [tenderNedFilteredAndSorted, tenderNedCurrentPage]
  )

  const importAsTender = useCallback(async (item: TenderNedItem) => {
    setImportingId(item.publicatieId)
    try {
      const res = await fetch('/api/tenderned/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicatieId: item.publicatieId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? 'Import mislukt')
      }
      const created = await res.json()
      toast('Tender en documenten uit TenderNed geïmporteerd', 'success')
      setShowTenderNedPanel(false)
      router.push(`/tenders/${created.id}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Tender toevoegen mislukt', 'error')
    } finally {
      setImportingId(null)
    }
  }, [router, toast])

  const filtered = useMemo(() => {
    let list = [...initialTenders]

    if (search) {
      const q = search.toLowerCase()
      list = list.filter((t) =>
        t.title?.toLowerCase().includes(q) ||
        t.referenceNumber?.toLowerCase().includes(q) ||
        t.contractingAuthority?.toLowerCase().includes(q)
      )
    }

    if (statusFilter !== 'all') {
      list = list.filter((t) => t.status === statusFilter)
    }

    if (goNoGoFilter !== 'all') {
      list = list.filter((t) => t.goNoGo === goNoGoFilter)
    }

    list.sort((a, b) => {
      let av: number = 0
      let bv: number = 0

      if (sortBy === 'deadline') {
        av = a.deadlineSubmission ? new Date(a.deadlineSubmission).getTime() : Infinity
        bv = b.deadlineSubmission ? new Date(b.deadlineSubmission).getTime() : Infinity
      } else if (sortBy === 'value') {
        av = parseFloat(a.estimatedValue || '0')
        bv = parseFloat(b.estimatedValue || '0')
      } else {
        av = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
        bv = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
      }

      return sortDir === 'asc' ? av - bv : bv - av
    })

    return list
  }, [initialTenders, search, statusFilter, goNoGoFilter, sortBy, sortDir])

  const toggleSort = (col: 'deadline' | 'updated' | 'value') => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(col); setSortDir('asc') }
  }

  const toggleTenderNedSort = (col: 'title' | 'authority' | 'deadline' | 'procedure') => {
    if (tenderNedSortBy === col) setTenderNedSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setTenderNedSortBy(col)
      setTenderNedSortDir(col === 'deadline' ? 'asc' : 'asc')
    }
  }

  return (
    <div style={{ padding: '16px 32px 48px', position: 'relative' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>
            Tenders
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            {filtered.length} tender{filtered.length !== 1 ? 's' : ''}
            {statusFilter !== 'all' || goNoGoFilter !== 'all' || search ? ' (gefilterd)' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button
            variant="secondary"
            onClick={openTenderNed}
            icon={
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            }
          >
            Importeren uit TenderNed
          </Button>
        </div>
      </div>

      {/* TenderNed import panel */}
      {showTenderNedPanel && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setShowTenderNedPanel(false)}
        >
          <div
            style={{
              background: 'white',
              border: '1px solid var(--border)',
              borderRadius: 8,
              maxWidth: 900,
              width: '100%',
              maxHeight: '85vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: 18, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--navy)' }}>
                  Aankondigingen van TenderNed
                </h2>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Kies een aankondiging om als tender in BidMind toe te voegen. Data: <a href="https://www.tenderned.nl" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--slate-blue)' }}>tenderned.nl</a>
                </p>
              </div>
              <button
                onClick={() => setShowTenderNedPanel(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-secondary)' }}
                aria-label="Sluiten"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
              {tenderNedLoading ? (
                <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>Alle aankondigingen ophalen…</div>
              ) : tenderNedData ? (
                <>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
                      <svg style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      </svg>
                      <input
                        value={tenderNedSearch}
                        onChange={(e) => setTenderNedSearch(e.target.value)}
                        placeholder="Zoek op titel, kenmerk, dienst..."
                        style={{
                          width: '100%',
                          paddingLeft: 28,
                          paddingRight: 10,
                          paddingBlock: 6,
                          border: '1px solid var(--border)',
                          borderRadius: 4,
                          fontSize: 13,
                          fontFamily: 'IBM Plex Sans, sans-serif',
                          outline: 'none',
                          color: 'var(--text-primary)',
                        }}
                      />
                    </div>
                    <select
                      value={tenderNedProcedureFilter}
                      onChange={(e) => setTenderNedProcedureFilter(e.target.value)}
                      style={{
                        padding: '6px 10px',
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        fontSize: 13,
                        fontFamily: 'IBM Plex Sans, sans-serif',
                        color: 'var(--text-primary)',
                        background: 'white',
                        cursor: 'pointer',
                        outline: 'none',
                        minWidth: 200,
                      }}
                    >
                      <option value="all">Alle procedures</option>
                      {tenderNedProcedureOptions.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    {(tenderNedSearch || tenderNedProcedureFilter !== 'all') && (
                      <button
                        onClick={() => { setTenderNedSearch(''); setTenderNedProcedureFilter('all') }}
                        style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 12, fontFamily: 'IBM Plex Sans, sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        Wis filters
                      </button>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    {tenderNedFilteredAndSorted.length} resultaten van {tenderNedData.content.length} aankondigingen
                    {(tenderNedSearch || tenderNedProcedureFilter !== 'all') && ' (gefilterd)'}
                  </p>
                  <div style={{ background: 'var(--off-white)', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border)' }}>
                          {[
                            { key: 'title' as const, label: 'Titel' },
                            { key: 'authority' as const, label: 'Aanbestedende dienst' },
                            { key: 'deadline' as const, label: 'Sluitingsdatum' },
                            { key: 'procedure' as const, label: 'Procedure' },
                          ].map(({ key, label }) => (
                            <th
                              key={key}
                              style={{
                                padding: '10px 12px',
                                textAlign: 'left',
                                fontWeight: 600,
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                userSelect: 'none',
                              }}
                              onClick={() => toggleTenderNedSort(key)}
                            >
                              {label}
                              {tenderNedSortBy === key && (
                                <span style={{ marginLeft: 4 }}>{tenderNedSortDir === 'asc' ? '↑' : '↓'}</span>
                              )}
                            </th>
                          ))}
                          <th style={{ padding: '10px 12px', width: 140 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {tenderNedFilteredAndSorted.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
                              Geen aankondigingen passen bij de gekozen zoek- of filteropties. Pas filters aan of wis ze.
                            </td>
                          </tr>
                        ) : tenderNedPageItems.map((item) => (
                          <tr key={item.publicatieId} style={{ borderBottom: '1px solid #F3F4F6' }}>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ fontWeight: 600, color: 'var(--navy)' }}>{item.title}</div>
                              {item.referenceNumber && (
                                <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'IBM Plex Mono, monospace' }}>{item.referenceNumber}</div>
                              )}
                            </td>
                            <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{item.contractingAuthority || '—'}</td>
                            <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                              {item.deadlineSubmission ? formatDate(new Date(item.deadlineSubmission)) : '—'}
                            </td>
                            <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{item.procedureType || '—'}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <Button
                                variant="secondary"
                                size="sm"
                                loading={importingId === item.publicatieId}
                                onClick={() => importAsTender(item)}
                              >
                                Als tender toevoegen
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {tenderNedTotalFilteredPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        Pagina {tenderNedCurrentPage + 1} van {tenderNedTotalFilteredPages} ({tenderNedFilteredAndSorted.length.toLocaleString('nl-NL')} resultaten)
                      </span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setTenderNedViewPage((p) => Math.max(0, p - 1))}
                          disabled={tenderNedCurrentPage <= 0}
                        >
                          Vorige
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setTenderNedViewPage((p) => Math.min(tenderNedTotalFilteredPages - 1, p + 1))}
                          disabled={tenderNedCurrentPage >= tenderNedTotalFilteredPages - 1}
                        >
                          Volgende
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: 10,
        marginBottom: 16,
        flexWrap: 'wrap',
        background: 'white',
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: '12px 16px',
        alignItems: 'center',
      }}>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
          <svg
            style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Zoek op titel, kenmerk, dienst..."
            style={{
              width: '100%',
              paddingLeft: 28,
              paddingRight: 10,
              paddingBlock: 6,
              border: '1px solid var(--border)',
              borderRadius: 4,
              fontSize: 13,
              fontFamily: 'IBM Plex Sans, sans-serif',
              outline: 'none',
              color: 'var(--text-primary)',
            }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '6px 10px',
            border: '1px solid var(--border)',
            borderRadius: 4,
            fontSize: 13,
            fontFamily: 'IBM Plex Sans, sans-serif',
            color: 'var(--text-primary)',
            background: 'white',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={goNoGoFilter}
          onChange={(e) => setGoNoGoFilter(e.target.value)}
          style={{
            padding: '6px 10px',
            border: '1px solid var(--border)',
            borderRadius: 4,
            fontSize: 13,
            fontFamily: 'IBM Plex Sans, sans-serif',
            color: 'var(--text-primary)',
            background: 'white',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="all">Go/No-Go: Alle</option>
          <option value="pending">Afwachten</option>
          <option value="go">Go</option>
          <option value="no_go">No Go</option>
        </select>
        {(search || statusFilter !== 'all' || goNoGoFilter !== 'all') && (
          <button
            onClick={() => { setSearch(''); setStatusFilter('all'); setGoNoGoFilter('all') }}
            style={{
              background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer',
              fontSize: 12, fontFamily: 'IBM Plex Sans, sans-serif', display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Wis filters
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--off-white)' }}>
                {[
                  { label: 'Status', key: null, width: 100 },
                  { label: 'Titel', key: null, width: null },
                  { label: 'Aanbesteder', key: null, width: 160 },
                  { label: 'Kenmerk', key: null, width: 120 },
                  { label: 'Deadline', key: 'deadline', width: 120 },
                  { label: 'Waarde', key: 'value', width: 110 },
                  { label: 'Manager', key: null, width: 80 },
                  { label: 'Win%', key: null, width: 60 },
                  { label: 'Go/No-Go', key: null, width: 90 },
                  { label: '', key: null, width: 52 },
                ].map((col) => (
                  <th
                    key={col.label}
                    style={{
                      padding: '10px 14px',
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                      width: col.width || undefined,
                      cursor: col.key ? 'pointer' : 'default',
                      userSelect: 'none',
                    }}
                    onClick={() => col.key && toggleSort(col.key as 'deadline' | 'value')}
                  >
                    {col.label}
                    {col.key === sortBy && (
                      <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                      </svg>
                      <div>
                        <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Geen tenders gevonden</p>
                        <p style={{ fontSize: 12 }}>Pas de filters aan of maak een nieuwe tender aan</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((tender, i) => {
                  const manager = tender.tenderManagerId ? userMap[tender.tenderManagerId] : null
                  const daysLeft = getDaysUntil(tender.deadlineSubmission)
                  const isUrgent = daysLeft !== null && daysLeft <= 7 && daysLeft >= 0

                  return (
                    <motion.tr
                      key={tender.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.2 }}
                      style={{
                        borderBottom: '1px solid #F3F4F6',
                        cursor: 'pointer',
                        background: i % 2 === 0 ? 'white' : 'var(--off-white)',
                      }}
                      onClick={() => router.push(`/tenders/${tender.id}`)}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#F0F4FF' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'white' : 'var(--off-white)' }}
                    >
                      <td style={{ padding: '11px 14px' }}>
                        <Badge variant="status" value={tender.status || 'new'} />
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', marginBottom: 2 }}>
                          {tender.title || '—'}
                        </div>
                        {tender.contractingAuthority && (
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{tender.contractingAuthority}</div>
                        )}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>
                        {tender.contractingAuthority || '—'}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--text-secondary)' }}>
                          {tender.referenceNumber || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        {tender.deadlineSubmission ? (
                          <div>
                            <div style={{ fontSize: 12, color: isUrgent ? 'var(--error)' : 'var(--text-primary)', fontWeight: isUrgent ? 600 : 400 }}>
                              {formatDate(tender.deadlineSubmission)}
                            </div>
                            {daysLeft !== null && daysLeft >= 0 && (
                              <div style={{ fontSize: 11, color: isUrgent ? '#DC2626' : 'var(--muted)' }}>
                                {daysLeft === 0 ? 'Vandaag' : `${daysLeft}d`}
                              </div>
                            )}
                          </div>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Mono, monospace' }}>
                        {formatCurrency(tender.estimatedValue)}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        {manager ? (
                          <div title={manager.name || ''}>
                            <Avatar name={manager.name || ''} src={manager.avatarUrl} size={26} />
                          </div>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: (tender.winProbability || 0) >= 50 ? '#059669' : 'var(--text-secondary)',
                          fontFamily: 'IBM Plex Mono, monospace',
                        }}>
                          {tender.winProbability ?? 0}%
                        </div>
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <Badge variant="gonogo" value={tender.goNoGo || 'pending'} />
                      </td>
                      <td style={{ padding: '11px 14px', width: 52 }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          aria-label="Tender verwijderen"
                          disabled={deletingId === tender.id}
                          onClick={(ev) => handleDeleteTender(ev, tender.id, tender.title || '')}
                          style={{
                            padding: 6,
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--muted)',
                            cursor: deletingId === tender.id ? 'wait' : 'pointer',
                            borderRadius: 4,
                          }}
                          onMouseEnter={(ev) => {
                            if (deletingId !== tender.id) {
                              ev.currentTarget.style.background = 'var(--off-white)'
                              ev.currentTarget.style.color = 'var(--error, #DC2626)'
                            }
                          }}
                          onMouseLeave={(ev) => {
                            ev.currentTarget.style.background = 'transparent'
                            ev.currentTarget.style.color = 'var(--muted)'
                          }}
                        >
                          {deletingId === tender.id ? (
                            <span style={{ fontSize: 12 }}>…</span>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <line x1="10" y1="11" x2="10" y2="17" />
                              <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                          )}
                        </button>
                      </td>
                    </motion.tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
