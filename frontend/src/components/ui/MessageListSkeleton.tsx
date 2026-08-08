import { Skeleton } from './Skeleton'

export function MessageListSkeleton() {
  return (
    <div style={{
      padding: 'var(--space-lg)',
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      maxWidth: 700,
      margin: '0 auto',
    }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <Skeleton width={36} height={36} circle />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton width={80} height={12} />
            <Skeleton width={i % 2 === 0 ? '70%' : '55%'} height={16} />
            <Skeleton width={i % 3 === 0 ? '40%' : '30%'} height={16} />
          </div>
        </div>
      ))}
    </div>
  )
}
