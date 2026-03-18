'use client'

import Link from 'next/link'

export default function InstellingenPage() {
  return (
    <div style={{ padding: '16px 32px 48px', maxWidth: 700 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>
          Instellingen
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          Beheer je BidMind configuratie
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Bedrijfsinformatie link */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 4, padding: 24 }}>
          <h3 style={{ fontSize: 14, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>
            Bedrijfsinformatie
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
            Vul bedrijfsgegevens, visiedocumenten, jaarplannen en vrije tekstvelden in. De AI gebruikt dit voor analyse en maatwerk aanbiedingen.
          </p>
          <Link
            href="/bedrijfsinformatie"
            style={{
              fontSize: 13, fontWeight: 600, color: 'var(--amber)', textDecoration: 'none',
            }}
          >
            Naar Bedrijfsinformatie →
          </Link>
        </div>

        {/* Notifications */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 4, padding: 24 }}>
          <h3 style={{ fontSize: 14, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--navy)', marginBottom: 18 }}>
            Notificaties
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'E-mail bij NVI deadline (7 dagen van tevoren)', default: true },
              { label: 'E-mail bij inschrijvingsdeadline (14 dagen van tevoren)', default: true },
              { label: 'E-mail bij documentupload door teamlid', default: false },
              { label: 'Dagelijkse samenvatting van openstaande taken', default: false },
            ].map(({ label, default: defaultOn }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{label}</span>
                <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input type="checkbox" defaultChecked={defaultOn} style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
                  <div style={{
                    width: 36, height: 20, background: defaultOn ? '#F5A623' : '#D1D5DB', borderRadius: 10,
                    transition: 'background 0.2s',
                  }}>
                    <div style={{
                      width: 16, height: 16, background: 'white', borderRadius: '50%',
                      position: 'relative', top: 2, left: defaultOn ? 18 : 2, transition: 'left 0.2s',
                    }} />
                  </div>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* API keys info */}
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 4, padding: 20 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: '#92400E', marginBottom: 8 }}>
            ⚙ Configuratie
          </h4>
          <p style={{ fontSize: 12, color: '#78350F', lineHeight: 1.6 }}>
            API-sleutels en omgevingsvariabelen worden beheerd via het <code style={{ fontFamily: 'IBM Plex Mono, monospace', background: '#FEF3C7', padding: '1px 4px', borderRadius: 2 }}>.env.local</code> bestand.
            Zie de README voor een overzicht van alle benodigde variabelen.
          </p>
        </div>

        <button
          style={{
            background: '#F5A623', color: 'white', border: 'none', borderRadius: 4,
            padding: '9px 18px', fontSize: 13, fontWeight: 600, fontFamily: 'IBM Plex Sans, sans-serif',
            cursor: 'pointer', width: 'fit-content',
          }}
        >
          Wijzigingen opslaan
        </button>
      </div>
    </div>
  )
}
