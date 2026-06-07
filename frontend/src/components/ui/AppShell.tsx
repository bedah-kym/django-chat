import type { ReactNode } from 'react'
import styles from './AppShell.module.css'

interface Props {
  sidebar?: ReactNode
  drawer?: ReactNode
  header?: ReactNode
  footer?: ReactNode
  children: ReactNode
  contentClassName?: string
}

export function AppShell({ sidebar, drawer, header, footer, children, contentClassName }: Props) {
  return (
    <div className={styles.shell}>
      <a href="#main-content" className={styles.skipLink}>
        Skip to main content
      </a>
      {sidebar}
      {drawer}
      <div className={styles.mainColumn}>
        {header}
        <main id="main-content" className={`${styles.mainContent} ${contentClassName ?? ''}`}>
          {children}
        </main>
        {footer}
      </div>
    </div>
  )
}
