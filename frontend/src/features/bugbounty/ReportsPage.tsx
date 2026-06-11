import { useState } from 'react'
import { useBugBountyStore } from '@/stores/bugbountyStore'
import { formatCurrency } from '@/utils/format'
import { ReportDraftModal } from './components/ReportDraftModal'
import styles from './BugBountyPage.module.css'
import reportStyles from './ReportsPage.module.css'

export function ReportsPage() {
  const [showDraft, setShowDraft] = useState(false)
  const reports = useBugBountyStore((s) => s.reports)
  const drafts = useBugBountyStore((s) => s.drafts)

  return (
    <div className={reportStyles.page}>
      <div className={reportStyles.header}>
        <div>
          <h1 className={reportStyles.title}>Reports</h1>
          <p className={reportStyles.description}>Review drafts, track triage, and keep the program pipeline visible in one place.</p>
        </div>
        <button type="button" className={reportStyles.primaryBtn} onClick={() => setShowDraft(true)}>Review Draft</button>
      </div>

      <div className={styles.reportList}>
        {reports.map(report => (
          <div key={report.id} className={styles.reportRow}>
            <span className={styles.reportTitle}>{report.title}</span>
            <span className={styles.reportTarget}>{report.target}</span>
            <span className={styles.reportAmount}>{formatCurrency(report.bountyKes)}</span>
            <span className={`${styles.platformBadge} ${styles[report.platform]}`}>{report.platform}</span>
            <span className={`${styles.statusBadge} ${styles[report.status]}`}>{report.status}</span>
          </div>
        ))}
      </div>

      {showDraft && drafts[0] && <ReportDraftModal draft={drafts[0]} onClose={() => setShowDraft(false)} />}
    </div>
  )
}
