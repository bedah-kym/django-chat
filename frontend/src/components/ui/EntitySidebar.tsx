import type { ReactNode } from 'react'
import styles from './EntitySidebar.module.css'

interface Props {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
}

export function EntitySidebar({ title, subtitle, actions, children }: Props) {
  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{title}</h2>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </div>
        {actions ? <div>{actions}</div> : null}
      </div>
      <div className={styles.body}>{children}</div>
    </div>
  )
}
