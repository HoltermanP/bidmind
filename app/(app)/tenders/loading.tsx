import Skeleton from '@/components/ui/Skeleton'

export default function TendersLoading() {
  return (
    <div style={{ padding: '16px 32px 48px' }}>
      <Skeleton width={150} height={28} style={{ marginBottom: 8 }} />
      <Skeleton width={200} height={16} style={{ marginBottom: 24 }} />

      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 4, padding: 16, marginBottom: 16 }}>
        <Skeleton width="100%" height={36} />
      </div>

      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ padding: '14px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', gap: 16, alignItems: 'center' }}>
            <Skeleton width={80} height={20} />
            <Skeleton width={220} height={16} />
            <Skeleton width={120} height={16} />
            <Skeleton width={80} height={16} />
          </div>
        ))}
      </div>
    </div>
  )
}
