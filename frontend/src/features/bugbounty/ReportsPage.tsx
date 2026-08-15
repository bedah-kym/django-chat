import { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import { useBugBountyStore } from '@/stores/bugbountyStore'
import { ReportDraftModal } from './components/ReportDraftModal'
import { ReportRow } from './components/ReportRow'
import styles from './ReportsPage.module.css'

export function ReportsPage() {
  const [showDraft, setShowDraft] = useState(false)
  const reports = useBugBountyStore((s) => s.reports)
  const drafts = useBugBountyStore((s) => s.drafts)
  const initialize = useBugBountyStore((s) => s.initialize)

  useEffect(() => { initialize() }, [initialize])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Reports</h1>
          <p className={styles.description}>Review drafts, track triage, and keep the program pipeline visible.</p>
        </div>
        {drafts.length > 0 && (
          <button type="button" className={styles.primaryBtn} onClick={() => setShowDraft(true)}>Review Draft</button>
        )}
      </header>

      {reports.length === 0 ? (
        <div className={styles.emptyState}>
          <FileText size={22} />
          <p>No reports yet.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {reports.map(report => <ReportRow key={report.id} report={report} />)}
        </div>
      )}

      {showDraft && drafts[0] && <ReportDraftModal draft={drafts[0]} onClose={() => setShowDraft(false)} />}
    </div>
  )
}
