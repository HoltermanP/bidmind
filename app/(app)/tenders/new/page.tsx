'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

export default function NewTenderPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '',
    referenceNumber: '',
    contractingAuthority: '',
    procedureType: 'Europees openbaar',
    estimatedValue: '',
    deadlineQuestions: '',
    deadlineSubmission: '',
    tendernetUrl: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title) return

    setLoading(true)
    try {
      const res = await fetch('/api/tenders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          estimatedValue: form.estimatedValue ? parseFloat(form.estimatedValue) : null,
          deadlineQuestions: form.deadlineQuestions || null,
          deadlineSubmission: form.deadlineSubmission || null,
        }),
      })

      if (!res.ok) throw new Error('Mislukt')
      const data = await res.json()
      toast('Tender aangemaakt!', 'success')
      router.push(`/tenders/${data.id}`)
    } catch (err) {
      toast('Fout bij aanmaken tender', 'error')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #E2E0D8',
    borderRadius: 4,
    fontSize: 13,
    fontFamily: 'IBM Plex Sans, sans-serif',
    color: '#1A1A2E',
    outline: 'none',
    background: 'white',
  }

  const labelStyle = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: '#374151',
    marginBottom: 4,
  }

  return (
    <div style={{ padding: '16px 32px 48px', maxWidth: 700 }}>
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', color: '#4A7FA5', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'IBM Plex Sans, sans-serif', marginBottom: 12 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Terug
        </button>
        <h1 style={{ fontSize: 24, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: '#0A0F1E' }}>
          Nieuwe tender aanmaken
        </h1>
      </div>

      <div style={{ background: 'white', border: '1px solid #E2E0D8', borderRadius: 4, padding: 28 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: 18 }}>
            <div>
              <label style={labelStyle}>Tendertitel *</label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="bijv. Verbreding A27 knooppunt Houten"
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={labelStyle}>TenderNed kenmerk</label>
                <input
                  value={form.referenceNumber}
                  onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
                  placeholder="bijv. 2024-TN-445821"
                  style={{ ...inputStyle, fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}
                />
              </div>
              <div>
                <label style={labelStyle}>Aanbestedende dienst</label>
                <input
                  value={form.contractingAuthority}
                  onChange={(e) => setForm({ ...form, contractingAuthority: e.target.value })}
                  placeholder="bijv. Rijkswaterstaat"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
                  placeholder="bijv. 5000000"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={labelStyle}>NVI deadline</label>
                <input
                  type="datetime-local"
                  value={form.deadlineQuestions}
                  onChange={(e) => setForm({ ...form, deadlineQuestions: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Inschrijvingsdeadline</label>
                <input
                  type="datetime-local"
                  value={form.deadlineSubmission}
                  onChange={(e) => setForm({ ...form, deadlineSubmission: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>TenderNed URL</label>
              <input
                type="url"
                value={form.tendernetUrl}
                onChange={(e) => setForm({ ...form, tendernetUrl: e.target.value })}
                placeholder="https://www.tenderned.nl/..."
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
              <Button type="submit" variant="amber" loading={loading}>
                Tender aanmaken
              </Button>
              <Button type="button" variant="secondary" onClick={() => router.back()}>
                Annuleren
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
