import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { BanknoteArrowDown, FileText, ShieldCheck, RefreshCcw } from 'lucide-react'
import { mockPrograms, mockReportDraft, mockReports } from '@/mocks/bugBounty'
import { ProgramCard } from './components/ProgramCard'
import { BountyTracker } from './components/BountyTracker'
import { ReportDraftModal } from './components/ReportDraftModal'
import styles from './BugBountyPage.module.css'

const FILTERS = ['All', 'HackerOne', 'Bugcrowd', 'Intigriti'] as const

export function BugBountyPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All')
  const [showDraft, setShowDraft] = useState(false)

  const filteredPrograms = filter === 'All'
    ? mockPrograms
    : mockPrograms.filter(program => program.platform === filter)

  const totalEarned = mockReports.reduce((sum, report) => sum + report.bountyKes, 0)
  const openReports = mockReports.filter(report => ['draft', 'triaged'].includes(report.status)).length

  const stats = [
    { label: 'Total Earned KES', value: totalEarned.toLocaleString(), icon: BanknoteArrowDown },
    { label: 'Open Reports', value: openReports, icon: FileText },
    { label: 'Programs Enrolled', value: mockPrograms.length, icon: ShieldCheck },
  ]

  return (
    <div className={styles.page}>
      <div className={styles.statsRow}>
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={stat.label}
              className={styles.statCard}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className={styles.statIcon}><Icon size={20} /></div>
              <div className={styles.statValue}>{stat.value}</div>
              <div className={styles.statLabel}>{stat.label}</div>
            </motion.div>
          )
        })}
      </div>

      <BountyTracker />

      <div className={styles.sectionHeader}>
        <h2>Programs</h2>
        <button type="button" className={styles.syncBtn}>
          <RefreshCcw size={15} />
          Sync from H1
        </button>
      </div>

      <div className={styles.filters}>
        {FILTERS.map(item => (
          <button
            key={item}
            type="button"
            className={`${styles.filterPill} ${filter === item ? styles.filterActive : ''}`}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className={styles.programGrid}>
        {filteredPrograms.map(program => <ProgramCard key={program.id} program={program} />)}
      </div>

      <div className={styles.sectionHeader}>
        <h2>My Reports</h2>
        <div className={styles.reportActions}>
          <Link to="/app/security/bugbounty/reports" className={styles.linkBtn}>All Reports</Link>
          <button type="button" className={styles.syncBtn} onClick={() => setShowDraft(true)}>Review Draft</button>
        </div>
      </div>

      <div className={styles.reportList}>
        {mockReports.map(report => (
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
