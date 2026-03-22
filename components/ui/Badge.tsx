import React from 'react'
import { STATUS_LABELS, STATUS_COLORS, GO_NO_GO_LABELS } from '@/lib/utils/format'

interface BadgeProps {
  variant?: 'status' | 'gonogo' | 'priority' | 'document' | 'custom'
  value?: string
  label?: string
  color?: string
  bg?: string
  size?: 'sm' | 'md'
}

const PRIORITY_LABELS_NL: Record<string, string> = {
  critical: 'Kritiek',
  high: 'Hoog',
  medium: 'Gemiddeld',
  low: 'Laag',
}

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  critical: { bg: '#FEE2E2', text: '#991B1B' },
  high: { bg: '#FFF7ED', text: '#C2410C' },
  medium: { bg: '#FEF9C3', text: '#854D0E' },
  low: { bg: '#F0FDF4', text: '#166534' },
}

const GO_NO_GO_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#F3F4F6', text: '#374151' },
  go: { bg: '#D1FAE5', text: '#065F46' },
  no_go: { bg: '#FEE2E2', text: '#991B1B' },
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  aankondiging: 'Aankondiging',
  bestek: 'Bestek',
  leidraad: 'Leidraad',
  tekening: 'Tekening',
  nota_van_inlichtingen: 'NVI',
  eigen_upload: 'Upload',
  concept_aanbieding: 'Concept',
  definitief: 'Definitief',
}

export default function Badge({ variant = 'custom', value = '', label, color, bg, size = 'sm' }: BadgeProps) {
  let displayLabel = label || value
  let textColor = color || '#374151'
  let bgColor = bg || '#F3F4F6'

  if (variant === 'status' && value) {
    displayLabel = STATUS_LABELS[value] || value
    textColor = STATUS_COLORS[value]?.text || textColor
    bgColor = STATUS_COLORS[value]?.bg || bgColor
  } else if (variant === 'gonogo' && value) {
    displayLabel = GO_NO_GO_LABELS[value] || value
    textColor = GO_NO_GO_COLORS[value]?.text || textColor
    bgColor = GO_NO_GO_COLORS[value]?.bg || bgColor
  } else if (variant === 'priority' && value) {
    displayLabel = PRIORITY_LABELS_NL[value] || value.charAt(0).toUpperCase() + value.slice(1)
    textColor = PRIORITY_COLORS[value]?.text || textColor
    bgColor = PRIORITY_COLORS[value]?.bg || bgColor
  } else if (variant === 'document' && value) {
    displayLabel = DOCUMENT_TYPE_LABELS[value] || value
  }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: size === 'sm' ? '2px 8px' : '4px 10px',
      borderRadius: 20,
      fontSize: size === 'sm' ? 11 : 12,
      fontWeight: 600,
      fontFamily: 'IBM Plex Sans, sans-serif',
      letterSpacing: '0.02em',
      whiteSpace: 'nowrap',
      background: bgColor,
      color: textColor,
    }}>
      {displayLabel}
    </span>
  )
}
