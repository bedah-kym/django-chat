import type { ReactNode } from 'react'
import styles from './SectionHeader.module.css'

interface Props {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}

export function SectionHeader({ eyebrow, title, description, action }: Props) {
  return (
    <div className={styles.header}>
      <div>
        {eyebrow ? <div className={styles.eyebrow}>{eyebrow}</div> : null}
        <h2 className={styles.title}>{title}</h2>
        {description ? <p className={styles.description}>{description}</p> : null}
      </div>
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  )
}
