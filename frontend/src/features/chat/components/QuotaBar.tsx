import { Upload } from 'lucide-react'
import styles from './QuotaBar.module.css'

interface Props {
  remaining: number
  total: number
}

export function QuotaBar({ remaining, total }: Props) {
  const pct = total > 0 ? (remaining / total) * 100 : 0
  const status = remaining === 0 ? 'danger' : remaining <= total * 0.2 ? 'warning' : 'normal'

  return (
    <div className={`${styles.bar} ${styles[status]}`}>
      <Upload size={12} />
      <span className={styles.label}>
        Uploads: <strong className={styles.count}>{remaining}</strong> / {total} remaining
      </span>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
