import { Skeleton } from './Skeleton'

export function RouteSkeleton() {
  return (
    <div style={{
      padding: 'var(--space-xl)',
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
      maxWidth: 720,
    }}>
      <Skeleton width="30%" height={14} />
      <Skeleton width="60%" height={28} />
      <Skeleton width="45%" height={16} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height={40} />
        ))}
      </div>
    </div>
  )
}
