import { db } from '@/lib/db'
import { tenders, tenderActivities, users } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'
import { formatDate, formatRelativeTime, getDaysUntil, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils/format'
import Avatar from '@/components/ui/Avatar'
import Link from 'next/link'
import PipelineAgentCards from '@/components/dashboard/PipelineAgentCards'
import PipelineMobileStack from '@/components/dashboard/PipelineMobileStack'
import { PIPELINE_AGENT_LABELS, PIPELINE_AGENT_DESCRIPTIONS } from '@/lib/tender/pipeline'
import { displayTenderTitle } from '@/lib/tenders/resolve-project-title'

export const dynamic = 'force-dynamic'

async function getDashboardData() {
  if (!db) {
    return {
      kpi: { activeTenders: 0, upcomingDeadlines: 0, goNoGoRequired: 0, submittedThisQuarter: 0, winRate: 0 },
      recentActivities: [],
      upcomingAll: [],
      pipeline: ['new', 'qualifying', 'analyzing', 'writing', 'review', 'submitted', 'won', 'lost'].map((stage) => ({ stage, count: 0 })),
      userMap: {} as Record<string, { id: string; name: string | null; email: string | null; avatarUrl: string | null }>,
    }
  }
  const now = new Date()
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)

  const [allTenders, recentActivities, allUsers] = await Promise.all([
    db.select().from(tenders).orderBy(desc(tenders.updatedAt)),
    db.select().from(tenderActivities).orderBy(desc(tenderActivities.createdAt)).limit(20),
    db.select().from(users),
  ])

  const activeTenders = allTenders.filter((t) =>
    !['submitted', 'won', 'lost', 'withdrawn'].includes(t.status || '')
  )
  const upcomingDeadlines = allTenders.filter((t) => {
    const days = getDaysUntil(t.deadlineSubmission)
    return days !== null && days >= 0 && days <= 7
  })
  const goNoGoRequired = allTenders.filter((t) => t.goNoGo === 'pending' && !['won', 'lost', 'withdrawn'].includes(t.status || ''))
  const submittedThisQuarter = allTenders.filter((t) => t.status === 'submitted' && t.updatedAt && t.updatedAt >= quarterStart)
  const wonCount = allTenders.filter((t) => t.status === 'won').length
  const submittedCount = allTenders.filter((t) => ['submitted', 'won', 'lost'].includes(t.status || '')).length
  const winRate = submittedCount > 0 ? Math.round((wonCount / submittedCount) * 100) : 0

  const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u]))

  const pipelineStages = ['new', 'qualifying', 'analyzing', 'writing', 'review', 'submitted', 'won', 'lost']
  const pipeline = pipelineStages.map((stage) => ({
    stage,
    count: allTenders.filter((t) => t.status === stage).length,
  }))

  const upcomingAll = allTenders
    .filter((t) => {
      const nviDays = getDaysUntil(t.deadlineQuestions)
      const subDays = getDaysUntil(t.deadlineSubmission)
      return (nviDays !== null && nviDays >= 0) || (subDays !== null && subDays >= 0)
    })
    .flatMap((t) => {
      const items = []
      const nviDays = getDaysUntil(t.deadlineQuestions)
      const subDays = getDaysUntil(t.deadlineSubmission)
      if (nviDays !== null && nviDays >= 0) {
        items.push({ tender: t, type: 'NVI', date: t.deadlineQuestions, daysLeft: nviDays })
      }
      if (subDays !== null && subDays >= 0) {
        items.push({ tender: t, type: 'Inschrijving', date: t.deadlineSubmission, daysLeft: subDays })
      }
      return items
    })
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 8)

  return {
    kpi: {
      activeTenders: activeTenders.length,
      upcomingDeadlines: upcomingDeadlines.length,
      goNoGoRequired: goNoGoRequired.length,
      submittedThisQuarter: submittedThisQuarter.length,
      winRate,
    },
    recentActivities,
    upcomingAll,
    pipeline,
    userMap,
  }
}

export default async function DashboardPage() {
  const { kpi, recentActivities, upcomingAll, pipeline, userMap } = await getDashboardData()

  const kpiCards = [
    { label: 'Actieve tenders', value: kpi.activeTenders, color: 'var(--slate-blue)', href: '/tenders?status=active' },
    { label: 'Deadlines binnen 7 dagen', value: kpi.upcomingDeadlines, color: 'var(--amber)', href: '/kalender' },
    { label: 'Go/No-Go vereist', value: kpi.goNoGoRequired, color: '#DC2626', href: '/tenders?gonogo=pending' },
    { label: 'Ingediend dit kwartaal', value: kpi.submittedThisQuarter, color: '#059669', href: '/tenders?status=submitted' },
    { label: 'Win rate', value: `${kpi.winRate}%`, color: '#7C3AED', href: '/tenders?status=won' },
  ]

  const totalTenders = pipeline.reduce((s, p) => s + p.count, 0)
  const pipelinePct = (stageCount: number) => (totalTenders > 0 ? Math.round((stageCount / totalTenders) * 100) : 0)
  const pendingDecision = pipeline.find((p) => p.stage === 'submitted')?.count ?? 0
  const lostCount = pipeline.find((p) => p.stage === 'lost')?.count ?? 0
  const activeAgentsCount = 8

  return (
    <div className="dashboard-page">
      {/* Page header */}
      <header className="dashboard-header">
        <h1 className="dashboard-title">Dashboard</h1>
        <p className="dashboard-subtitle">Overzicht van alle lopende tenderprocedures</p>
      </header>

      {/* Tender pipeline — dark theme, kaarten met pijlen, AI agents eronder, footer stats */}
      <section className="dashboard-pipeline-section dashboard-pipeline-dark">
        <div className="dashboard-pipeline-header">
          <div>
            <h2 className="dashboard-pipeline-title">Tender pipeline</h2>
            <p className="dashboard-pipeline-subtitle">
              {totalTenders} tenders · {activeAgentsCount} AI agents actief
            </p>
          </div>
          <Link href="/tenders" className="dashboard-pipeline-link">Alle tenders →</Link>
        </div>

        <div className="dashboard-pipeline-desktop-only">
          <div className="dashboard-pipeline-grid">
            {/* Stage cards — kolommen 0, 2, 4, 6, 8, 10, 12, 14 */}
            {pipeline.map((stage, i) => {
              const colors = STATUS_COLORS[stage.stage]
              const bg = colors?.bg ?? '#F3F4F6'
              const accent = colors?.text ?? 'var(--text-secondary)'
              return (
                <Link
                  key={stage.stage}
                  href={`/tenders?status=${stage.stage}`}
                  className="dashboard-pipeline-stage"
                  style={{ '--stage-bg': bg, '--stage-accent': accent, gridColumn: 2 * i + 1 } as React.CSSProperties}
                >
                  <span className="dashboard-pipeline-count">{stage.count}</span>
                  <span className="dashboard-pipeline-label">{STATUS_LABELS[stage.stage] ?? stage.stage}</span>
                </Link>
              )
            })}
            {/* Pijlen — kolommen 1, 3, 5, 7, 9, 11, 13 */}
            {Array.from({ length: 7 }).map((_, i) => (
              <span key={`arrow-${i}`} className="dashboard-pipeline-arrow" style={{ gridColumn: 2 * i + 2 }} aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </span>
            ))}
            {/* Agent cards — onder de stage cards, tooltip via portal (tekst past in wolkje) */}
            <PipelineAgentCards
              pipeline={pipeline}
              totalTenders={totalTenders}
              agentLabels={PIPELINE_AGENT_LABELS}
              agentDescriptions={PIPELINE_AGENT_DESCRIPTIONS}
            />
          </div>
        </div>

        <div className="dashboard-pipeline-mobile-only">
          <PipelineMobileStack
            pipeline={pipeline}
            totalTenders={totalTenders}
            agentLabels={PIPELINE_AGENT_LABELS}
            agentDescriptions={PIPELINE_AGENT_DESCRIPTIONS}
          />
        </div>

        <div className="dashboard-pipeline-divider" />
        <div className="dashboard-pipeline-stats">
          <div className="dashboard-pipeline-stat">
            <span className="dashboard-pipeline-stat-value">{kpi.activeTenders}</span>
            <span className="dashboard-pipeline-stat-label">Totaal actief</span>
          </div>
          <div className="dashboard-pipeline-stat">
            <span className="dashboard-pipeline-stat-value dashboard-pipeline-stat-warning">{pendingDecision}</span>
            <span className="dashboard-pipeline-stat-label">Wacht op beslissing</span>
          </div>
          <div className="dashboard-pipeline-stat">
            <span className="dashboard-pipeline-stat-value dashboard-pipeline-stat-success">{kpi.winRate}%</span>
            <span className="dashboard-pipeline-stat-label">Win rate</span>
          </div>
          <div className="dashboard-pipeline-stat">
            <span className="dashboard-pipeline-stat-value dashboard-pipeline-stat-error">{lostCount}</span>
            <span className="dashboard-pipeline-stat-label">Verloren</span>
          </div>
        </div>
      </section>

      {/* KPI Row — compacter */}
      <div className="dashboard-kpi-grid">
        {kpiCards.map((card) => (
          <Link key={card.label} href={card.href} className="dashboard-kpi-link">
            <div className="dashboard-kpi-card" style={{ borderTopColor: card.color }}>
              <span className="dashboard-kpi-value">{card.value}</span>
              <span className="dashboard-kpi-label">{card.label}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Twee kolommen — compacter: activiteit + deadlines */}
      <div className="dashboard-cols">
        <section className="dashboard-card dashboard-card-activity">
          <h2 className="dashboard-card-title">Recente activiteit</h2>
          <div className="dashboard-card-scroll">
            {recentActivities.length === 0 ? (
              <div className="dashboard-empty">
                <svg className="dashboard-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p>Nog geen activiteit</p>
              </div>
            ) : (
              <ul className="dashboard-activity-list">
                {recentActivities.map((activity, i) => {
                  const user = activity.userId ? userMap[activity.userId] : null
                  return (
                    <li key={activity.id} className="dashboard-activity-item">
                      <Avatar name={user?.name || 'Systeem'} src={user?.avatarUrl} size={22} />
                      <div className="dashboard-activity-content">
                        <span className="dashboard-activity-text">
                          <strong>{user?.name || 'Systeem'}</strong>
                          {' — '}
                          {activity.description}
                        </span>
                        <span className="dashboard-activity-meta">
                          {activity.createdAt ? `· ${formatRelativeTime(activity.createdAt)}` : ''}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="dashboard-card dashboard-card-deadlines">
          <h2 className="dashboard-card-title">Naderende deadlines</h2>
          <div className="dashboard-card-scroll">
            {upcomingAll.length === 0 ? (
              <div className="dashboard-empty">
                <svg className="dashboard-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <p>Geen deadlines gepland</p>
              </div>
            ) : (
              <ul className="dashboard-deadlines-list">
                {upcomingAll.map((item) => {
                  const isUrgent = item.daysLeft <= 3
                  const deadlineColor = item.type === 'NVI' ? 'var(--amber)' : 'var(--error)'
                  return (
                    <li key={`${item.tender.id}-${item.type}`}>
                      <Link href={`/tenders/${item.tender.id}`} className="dashboard-deadline-row">
                        <span
                          className="dashboard-deadline-days"
                          data-urgent={isUrgent}
                          style={{ color: item.type === 'NVI' ? 'var(--amber)' : 'var(--error)' }}
                        >
                          {item.daysLeft}d
                        </span>
                        <div className="dashboard-deadline-info">
                          <span className="dashboard-deadline-title">{displayTenderTitle(item.tender.title)}</span>
                          <span className="dashboard-deadline-meta" style={{ color: deadlineColor }}>
                            {item.type} — {formatDate(item.date)}
                          </span>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
