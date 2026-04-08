import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { mockPrograms, mockReportDraft, mockReports } from '@/mocks/bugBounty'
import { ReportDraftModal } from './components/ReportDraftModal'
import styles from './BugBountyPage.module.css'
import detailStyles from './ProgramDetailPage.module.css'

export function ProgramDetailPage() {
  const { programId } = useParams<{ programId: string }>()
  const [showDraft, setShowDraft] = useState(false)
  const fallbackProgram = mockPrograms[0]
  if (!fallbackProgram) return null
  const program = mockPrograms.find(item => item.id === programId) ?? fallbackProgram
  const reports = mockReports.filter(report => report.programId === program.id)

  return (
    <div className={detailStyles.page}>
      <Link to="/app/security/bugbounty" className={detailStyles.backLink}>Back to programs</Link>
      <div className={detailStyles.hero}>
        <div>
          <span className={`${styles.platformBadge} ${styles[program.platform]}`}>{program.platform}</span>
          <h1 className={detailStyles.title}>{program.name}</h1>
          <p className={detailStyles.description}>{program.rewardNotes}</p>
        </div>
        <div className={detailStyles.heroMeta}>
          <div><span>Range</span><strong>{program.bountyRange}</strong></div>
          <div><span>Assets</span><strong>{program.assetCount}</strong></div>
          <div><span>Last Scan</span><strong>{new Date(program.lastScannedAt).toLocaleString()}</strong></div>
        </div>
      </div>

      <div className={detailStyles.grid}>
        <section className={detailStyles.card}>
          <div className={detailStyles.cardTitle}>In Scope</div>
          {program.inScope.map(item => <div key={item} className={detailStyles.scopeRow}>{item}</div>)}
        </section>
        <section className={detailStyles.card}>
          <div className={detailStyles.cardTitle}>Out of Scope</div>
          {program.outOfScope.map(item => <div key={item} className={detailStyles.scopeRow}>{item}</div>)}
        </section>
      </div>

      <div className={detailStyles.sectionHeader}>
        <h2>Reports for This Program</h2>
        <button type="button" className={detailStyles.primaryBtn} onClick={() => setShowDraft(true)}>Draft Report</button>
      </div>
      <div className={styles.reportList}>
        {reports.map(report => (
          <div key={report.id} className={styles.reportRow}>
            <span className={styles.reportTitle}>{report.title}</span>
            <span className={styles.reportTarget}>{report.target}</span>
            <span className={styles.reportAmount}>KES {report.bountyKes.toLocaleString()}</span>
            <span className={`${styles.platformBadge} ${styles[report.platform]}`}>{report.platform}</span>
            <span className={`${styles.statusBadge} ${styles[report.status]}`}>{report.status}</span>
          </div>
        ))}
      </div>

      {showDraft && <ReportDraftModal draft={mockReportDraft} onClose={() => setShowDraft(false)} />}
    </div>
  )
}
