import type { ReactNode } from 'react'
import styles from './PageScaffold.module.css'

type PageMode = 'overview' | 'dense-workspace' | 'focused-detail'

interface Props {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  sidebar?: ReactNode
  children: ReactNode
  mode?: PageMode
  contentClassName?: string
}

export function PageScaffold({
  eyebrow,
  title,
  description,
  actions,
  sidebar,
  children,
  mode = 'overview',
  contentClassName,
}: Props) {
  const shellClassName = sidebar ? styles.withSidebar : styles.singleColumn

  return (
    <section className={`${styles.page} ${styles[mode]}`}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
          <h1 className={styles.title}>{title}</h1>
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </header>

      <div className={`${styles.body} ${shellClassName}`}>
        {sidebar ? <aside className={styles.sidebar}>{sidebar}</aside> : null}
        <div className={`${styles.content} ${contentClassName ?? ''}`}>{children}</div>
      </div>
    </section>
  )
}
