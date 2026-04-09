import { mockReports } from '@/mocks/bugBounty'
import { formatCurrency } from '@/utils/format'
import styles from './BountyTracker.module.css'

export function BountyTracker() {
  const paid = mockReports.filter(report => report.status === 'paid').reduce((sum, report) => sum + report.bountyKes, 0)
  const pending = mockReports.filter(report => report.status === 'triaged').reduce((sum, report) => sum + report.bountyKes, 0)

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
