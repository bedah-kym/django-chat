import { Link } from 'react-router-dom'
import { Radar, TimerReset } from 'lucide-react'
import type { BugBountyProgram } from '@/types/bugBounty'
import styles from './ProgramCard.module.css'

interface Props {
  program: BugBountyProgram
}

export function ProgramCard({ program }: Props) {
  return (
    <Link to={`/app/security/bugbounty/${program.id}`} className={styles.card}>
      <div className={styles.header}>
        <span className={`${styles.platform} ${styles[program.platform]}`}>{program.platform}</span>
        <span className={`${styles.status} ${styles[program.scanStatus]}`}>{program.scanStatus}</span>
      </div>
      <div className={styles.name}>{program.name}</div>
      <div className={styles.range}>{program.bountyRange}</div>
      <div className={styles.metaRow}>
        <span>{program.assetCount} assets</span>
        <span>{new Date(program.lastScannedAt).toLocaleString()}</span>
      </div>
      <div className={styles.footer}>
        <span className={styles.inline}><Radar size={14} />Last sweep ready</span>
        <span className={styles.scanBtn}>
          <TimerReset size={14} />
          Run Scan
        </span>
      </div>
    </Link>
  )
}
