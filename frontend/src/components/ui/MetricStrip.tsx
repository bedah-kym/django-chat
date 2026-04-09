import styles from './MetricStrip.module.css'

interface MetricItem {
  label: string
  value: string
  detail?: string
  tone?: 'default' | 'critical' | 'warning' | 'success' | 'info'
}

interface Props {
  items: MetricItem[]
}

export function MetricStrip({ items }: Props) {
  return (
    <div className={styles.strip}>
      {items.map((item) => (
        <div key={item.label} className={`${styles.item} ${item.tone ? styles[item.tone] : ''}`}>
          <div className={styles.label}>{item.label}</div>
          <div className={styles.value}>{item.value}</div>
          {item.detail ? <div className={styles.detail}>{item.detail}</div> : null}
        </div>
      ))}
    </div>
  )
}
