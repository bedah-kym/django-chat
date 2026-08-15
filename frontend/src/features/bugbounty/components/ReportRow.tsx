import { ExternalLink } from 'lucide-react'
import type { BugBountyReport } from '@/types/bugBounty'
import { formatCurrency, formatNumber } from '@/utils/format'
import styles from './ReportRow.module.css'

interface Props {
  report: BugBountyReport
}

export function ReportRow({ report }: Props) {
  return (
    <div className={styles.row}>
      <div className={styles.main}>
        <span className={styles.title}>{report.title}</span>
        {report.target ? <span className={styles.target}>{report.target}</span> : null}
      </div>

      <span className={`${styles.badge} ${styles[`s_${report.severity}`]}`}>{report.severity}</span>
      <span className={`${styles.badge} ${styles[`st_${report.status}`]}`}>{report.status}</span>
      <span className={`${styles.badge} ${styles[`p_${report.platform}`]}`}>{report.platform}</span>

      <div className={styles.right}>
        <span className={styles.amount}>
          {report.bountyKes > 0 ? formatCurrency(report.bountyKes) : formatNumber(report.bountyKes)}
        </span>
        {report.sourceUrl ? (
          <a
            className={styles.link}
            href={report.sourceUrl}
            target="_blank"
            rel="noreferrer"
            title="Open in HackerOne"
          >
            <ExternalLink size={14} />
          </a>
        ) : (
          <span className={styles.linkSlot} />
        )}
      </div>
    </div>
  )
}
