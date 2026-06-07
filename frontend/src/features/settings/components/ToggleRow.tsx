import { motion } from 'framer-motion'
import styles from './ToggleRow.module.css'

interface Props {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function ToggleRow({ label, description, checked, onChange }: Props) {
  return (
    <div className={styles.row}>
      <div className={styles.text}>
        <span className={styles.label}>{label}</span>
        {description && <span className={styles.desc}>{description}</span>}
      </div>
      <button
        className={`${styles.toggle} ${checked ? styles.on : ''}`}
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
        type="button"
      >
        <motion.div
          className={styles.thumb}
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  )
}
