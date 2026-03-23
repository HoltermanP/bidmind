export function formatCurrency(value: string | number | null): string {
  if (!value) return '—'
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

export function formatDate(date: Date | string | null, options?: Intl.DateTimeFormatOptions): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('nl-NL', options || {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

export function formatDateTime(date: Date | string | null): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function formatRelativeTime(date: Date | string | null): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diff = d.getTime() - now.getTime()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))

  if (days < 0) return `${Math.abs(days)} dagen geleden`
  if (days === 0) return 'Vandaag'
  if (days === 1) return 'Morgen'
  if (days < 7) return `${days} dagen`
  if (days < 14) return '1 week'
  if (days < 30) return `${Math.floor(days / 7)} weken`
  return `${Math.floor(days / 30)} maanden`
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function getDaysUntil(date: Date | string | null): number | null {
  if (!date) return null
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export const STATUS_LABELS: Record<string, string> = {
  new: 'Nieuw',
  qualifying: 'Kwalificatie',
  analyzing: 'Analyse',
  writing: 'Schrijven',
  review: 'Review',
  submitted: 'Ingediend',
  won: 'Gewonnen',
  lost: 'Verloren',
  withdrawn: 'Ingetrokken',
}

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  new: { bg: '#E8F0FE', text: '#1A56DB' },
  qualifying: { bg: '#FEF3C7', text: '#92400E' },
  analyzing: { bg: '#E0F2FE', text: '#075985' },
  writing: { bg: '#F3E8FF', text: '#6B21A8' },
  review: { bg: '#FFF7ED', text: '#C2410C' },
  submitted: { bg: '#ECFDF5', text: '#065F46' },
  won: { bg: '#D1FAE5', text: '#064E3B' },
  lost: { bg: '#FEE2E2', text: '#991B1B' },
  withdrawn: { bg: '#F3F4F6', text: '#374151' },
}

export const GO_NO_GO_LABELS: Record<string, string> = {
  pending: 'Afwachten',
  go: 'Go',
  no_go: 'No Go',
}

/** Intake-agent: geschiktheid tender t.o.v. bedrijf */
export const SUITABILITY_TIER_LABELS: Record<string, string> = {
  low: 'Laag',
  medium: 'Middel',
  high: 'Hoog',
}

export const SUITABILITY_TIER_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: '#F3F4F6', text: '#4B5563' },
  medium: { bg: '#FEF9C3', text: '#854D0E' },
  high: { bg: '#D1FAE5', text: '#065F46' },
}
