import { useBugBountyStore } from '@/stores/bugbountyStore'
import { formatCurrency } from '@/utils/format'
import styles from './BountyTracker.module.css'

export function BountyTracker() {
  const reports = useBugBountyStore((s) => s.reports)
  const paid = reports.filter(report => report.status === 'paid').reduce((sum, report) => sum + report.bountyKes, 0)
  const pending = reports.filter(report => report.status === 'triaged').reduce((sum, report) => sum + report.bountyKes, 0)

  return (
    <div className={styles.tracker}>
      <div>
        <div className={styles.label}>Bounty Tracker</div>
        <div className={styles.value}>{formatCurrency(paid)}</div>
      </div>
      <div className={styles.meta}>
        <span>Paid out</span>
        <span>Pipeline {formatCurrency(pending)}</span>
      </div>
    </div>
  )
}
