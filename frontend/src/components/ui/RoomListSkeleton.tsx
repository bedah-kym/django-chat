import { Skeleton } from './Skeleton'

export function RoomListSkeleton() {
  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px' }}>
          <Skeleton width={32} height={32} circle />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Skeleton width={`${50 + Math.random() * 30}%`} height={13} />
            <Skeleton width={`${70 + Math.random() * 25}%`} height={11} />
          </div>
        </div>
      ))}
    </div>
  )
}
