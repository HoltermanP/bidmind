import { db } from '@/lib/db'
import { users, tenders } from '@/lib/db/schema'
import { count, eq, or, sql } from 'drizzle-orm'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'

export const dynamic = 'force-dynamic'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  tender_manager: 'Tendermanager',
  team_member: 'Teamlid',
}

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  admin: { bg: '#F3E8FF', text: '#6B21A8' },
  tender_manager: { bg: '#E0F2FE', text: '#075985' },
  team_member: { bg: '#F3F4F6', text: '#374151' },
}

async function getTeamData() {
  if (!db) return []
  const allUsers = await db.select().from(users)
  const allTenders = await db.select().from(tenders)

  const userData = allUsers.map((user) => {
    const managing = allTenders.filter((t) => t.tenderManagerId === user.id).length
    const participating = allTenders.filter((t) => (t.teamMemberIds || []).includes(user.id)).length
    return { ...user, managing, participating, total: managing + participating }
  })

  return userData
}

export default async function TeamPage() {
  const teamData = await getTeamData()

  return (
    <div style={{ padding: '16px 32px 48px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: '#0A0F1E', marginBottom: 4 }}>
          Team
        </h1>
        <p style={{ color: '#6B7280', fontSize: 13 }}>
          {teamData.length} teamleden
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {teamData.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px 20px', color: '#9CA3AF', background: 'white', border: '1px solid #E2E0D8', borderRadius: 4 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1" style={{ display: 'block', margin: '0 auto 12px' }}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <p style={{ fontWeight: 600, color: '#374151', marginBottom: 4 }}>Geen teamleden</p>
            <p style={{ fontSize: 12 }}>Teamleden worden toegevoegd via Clerk authenticatie</p>
          </div>
        ) : (
          teamData.map((user) => {
            const roleColors = ROLE_COLORS[user.role || 'team_member']
            return (
              <div
                key={user.id}
                className="team-card-hover"
                style={{
                  background: 'white',
                  border: '1px solid #E2E0D8',
                  borderRadius: 4,
                  padding: 20,
                  transition: 'box-shadow 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
                  <Avatar name={user.name || ''} src={user.avatarUrl} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0A0F1E', marginBottom: 2 }}>
                      {user.name || '—'}
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }}>
                      {user.email}
                    </div>
                    <Badge
                      value={ROLE_LABELS[user.role || 'team_member']}
                      bg={roleColors?.bg}
                      color={roleColors?.text}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, borderTop: '1px solid #F3F4F6', paddingTop: 14 }}>
                  <div style={{ textAlign: 'center', padding: '8px 0' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Syne, sans-serif', color: '#0A0F1E' }}>
                      {user.managing}
                    </div>
                    <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>Beheert</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '8px 0', borderLeft: '1px solid #F3F4F6' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Syne, sans-serif', color: '#0A0F1E' }}>
                      {user.participating}
                    </div>
                    <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>Deelneemt</div>
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
