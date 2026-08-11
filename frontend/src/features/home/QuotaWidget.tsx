import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Gauge } from 'lucide-react'
import { useQuotaStore } from '@/stores/quotaStore'
import type { QuotaCategory } from '@/types/quota'
import styles from './QuotaWidget.module.css'

const TOP_CATEGORIES: (keyof Omit<import('@/types/quota').UserQuotas, 'plan'>)[] = [
  'messages',
  'actions',
  'search',
  'uploads',
]

function QuotaBar({ category }: { category: QuotaCategory }) {
  const pct = category.limit > 0 ? Math.min(100, (category.used / category.limit) * 100) : 0
  const fillClass =
    category.status === 'exhausted' ? styles.fillRed :
    category.status === 'critical' ? styles.fillOrange :
    category.status === 'warning' ? styles.fillYellow :
    styles.fillGreen

  return (
    <div className={styles.barRow}>
      <span className={styles.barLabel}>{category.name}</span>
      <div className={styles.barTrack}>
        <div className={`${styles.barFill} ${fillClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.barValue}>
        {category.used}/{category.limit}
      </span>
    </div>
  )
}

export function QuotaWidget() {
  const { quotas, fetchQuotas } = useQuotaStore()

  useEffect(() => {
    fetchQuotas()
  }, [fetchQuotas])

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <span className={styles.title}>
          <Gauge size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
          Usage Quotas
        </span>
        <Link to="/app/settings?tab=quotas" className={styles.link}>
          Details <ArrowRight size={12} />
        </Link>
      </div>
      {quotas ? (
        <div className={styles.bars}>
          {TOP_CATEGORIES.map((key) => (
            <QuotaBar key={key} category={quotas[key]} />
          ))}
        </div>
      ) : (
        <div className={styles.empty}>Loading quotas...</div>
      )}
    </div>
  )
}
