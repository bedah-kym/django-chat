import { Skeleton } from './Skeleton'

export function WalletSkeleton() {
  return (
    <div style={{
      padding: 'var(--space-xl)',
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
      maxWidth: 800,
    }}>
      <div style={{
        padding: 32,
        background: 'var(--surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        <Skeleton width={110} height={12} />
        <Skeleton width={160} height={36} />
        <Skeleton width={220} height={14} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{
            display: 'flex', gap: 16, alignItems: 'center',
            padding: '14px 18px',
            background: 'var(--surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
          }}>
            <Skeleton width={40} height={40} circle />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Skeleton width="45%" height={14} />
              <Skeleton width="60%" height={12} />
            </div>
            <Skeleton width={80} height={16} />
          </div>
        ))}
      </div>
    </div>
  )
}
