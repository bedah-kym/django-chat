import { useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import styles from './HistoryLoader.module.css'

interface Props {
  isLoading: boolean
  hasMore: boolean
  onLoadMore: () => void
}

export function HistoryLoader({ isLoading, hasMore, onLoadMore }: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isLoading) {
          onLoadMore()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, isLoading, onLoadMore])

  if (!hasMore && !isLoading) return null

  return (
    <div ref={sentinelRef} className={styles.loader}>
      {isLoading && (
        <div className={styles.spinner}>
          <Loader2 size={18} className={styles.icon} />
          <span>Loading earlier messages...</span>
        </div>
      )}
    </div>
  )
}
