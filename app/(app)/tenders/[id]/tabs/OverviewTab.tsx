'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import { formatCurrency } from '@/lib/utils/format'

interface Props {
  tender: any
  onUpdate: (updates: Record<string, any>) => void
  allUsers: any[]
  userMap: Record<string, any>
}

export default function OverviewTab({ tender, onUpdate, allUsers, userMap }: Props) {
  const [form, setForm] = useState({
    contractingAuthority: tender.contractingAuthority || '',
    procedureType: tender.procedureType || '',
    estimatedValue: tender.estimatedValue || '',
    tendernetUrl: tender.tendernetUrl || '',
    goNoGoReasoning: tender.goNoGoReasoning || '',
    cpvCodes: (tender.cpvCodes || []).join(', '),
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onUpdate({
      ...form,
      estimatedValue: form.estimatedValue || null,
      cpvCodes: form.cpvCodes.split(',').map((s: string) => s.trim()).filter(Boolean),
    })
    setSaving(false)
  }

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

  const labelStyle = {
    display: 'block' as const,
    fontSize: 12,
    fontWeight: 600 as const,
    color: 'var(--text-primary)',
    marginBottom: 4,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0, maxWidth: 700 }}>
      {/* Actiebalk –zelfde opmaak als andere tabs */}
      <div
        className="tender-tab-actions"
        style={{
          padding: '14px 0',
          marginBottom: 4,
          borderBottom: '1px solid #E5E7EB',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Syne, sans-serif', color: 'var(--navy)' }}>Overzicht</span>
      </div>
      {/* Tender info card */}
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 4, padding: 24 }}>
        <h3 style={{ fontSize: 14, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--navy)', marginBottom: 18 }}>
          Tendergegevens
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Aanbestedende dienst</label>
            <input
              value={form.contractingAuthority}
              onChange={(e) => setForm({ ...form, contractingAuthority: e.target.value })}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Procedure type</label>
            <select
              value={form.procedureType}
              onChange={(e) => setForm({ ...form, procedureType: e.target.value })}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option>Europees openbaar</option>
              <option>Europees niet-openbaar</option>
              <option>Meervoudig onderhands</option>
              <option>Enkelvoudig onderhands</option>
              <option>Concurrentiegerichte dialoog</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Geraamde waarde (€)</label>
            <input
              type="number"
              value={form.estimatedValue}
              onChange={(e) => setForm({ ...form, estimatedValue: e.target.value })}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>CPV-codes (komma gescheiden)</label>
            <input
              value={form.cpvCodes}
              onChange={(e) => setForm({ ...form, cpvCodes: e.target.value })}
              placeholder="bijv. 45233100, 45221111"
              style={inputStyle}
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>TenderNed URL</label>
            <input
              type="url"
              value={form.tendernetUrl}
              onChange={(e) => setForm({ ...form, tendernetUrl: e.target.value })}
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* Team assignment */}
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 4, padding: 24 }}>
        <h3 style={{ fontSize: 14, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--navy)', marginBottom: 18 }}>
          Tenderteam
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Tendermanager</label>
            <select
              value={tender.tenderManagerId || ''}
              onChange={(e) => onUpdate({ tenderManagerId: e.target.value || null })}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="">— Niet toegewezen —</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name || u.email}</option>
              ))}
            </select>
          </div>
        </div>
        <label style={labelStyle}>Teamleden</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {allUsers.map((u) => {
            const isSelected = (tender.teamMemberIds || []).includes(u.id)
            return (
              <button
                key={u.id}
                onClick={() => {
                  const current = tender.teamMemberIds || []
                  const updated = isSelected ? current.filter((id: string) => id !== u.id) : [...current, u.id]
                  onUpdate({ teamMemberIds: updated })
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px 4px 6px',
                  border: `1px solid ${isSelected ? 'var(--slate-blue)' : 'var(--border)'}`,
                  borderRadius: 20,
                  background: isSelected ? '#E0F2FE' : 'white',
                  cursor: 'pointer',
                  fontSize: 12, fontFamily: 'IBM Plex Sans, sans-serif',
                  color: isSelected ? 'var(--slate-blue)' : 'var(--text-primary)',
                  transition: 'all 0.15s',
                }}
              >
                <Avatar name={u.name || ''} size={18} />
                {u.name || u.email}
              </button>
            )
          })}
        </div>
      </div>

      {/* Go/No-Go reasoning */}
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 4, padding: 24 }}>
        <h3 style={{ fontSize: 14, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--navy)', marginBottom: 18 }}>
          Go/No-Go motivering
        </h3>
        <textarea
          value={form.goNoGoReasoning}
          onChange={(e) => setForm({ ...form, goNoGoReasoning: e.target.value })}
          placeholder="Documenteer hier de overwegingen voor de Go/No-Go beslissing..."
          rows={5}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
        />
      </div>

      <div>
        <Button variant="amber" loading={saving} onClick={handleSave}>
          Wijzigingen opslaan
        </Button>
      </div>
    </div>
  )
}
