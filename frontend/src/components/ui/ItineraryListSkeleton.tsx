import { Skeleton } from './Skeleton'

export function ItineraryListSkeleton() {
  return (
    <div style={{
      padding: 'var(--space-xl)',
      display: 'flex',
      flexDirection: 'column',
      gap: 32,
      maxWidth: 900,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton width={60} height={12} />
        <Skeleton width={160} height={28} />
        <Skeleton width={260} height={14} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{
            padding: 20,
            background: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}>
            <Skeleton width="80%" height={20} />
            <Skeleton width="50%" height={12} />
            <Skeleton width="35%" height={12} />
          </div>
        ))}
      </div>
    </div>
  )
}
