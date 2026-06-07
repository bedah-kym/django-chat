import styles from './StatusBadge.module.css'

type Tone = 'default' | 'success' | 'warning' | 'critical' | 'info' | 'muted'

interface Props {
  label: string
  tone?: Tone
}

export function StatusBadge({ label, tone = 'default' }: Props) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{label}</span>
}
