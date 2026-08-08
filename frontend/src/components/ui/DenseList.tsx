import type { ReactNode } from 'react'
import styles from './DenseList.module.css'

interface DenseListColumn {
  key: string
  label: string
  className?: string
}

interface DenseListRow {
  id: string
  href?: string
  onClick?: () => void
  cells: Record<string, ReactNode>
}

interface Props {
  columns: DenseListColumn[]
  rows: DenseListRow[]
}

export function DenseList({ columns, rows }: Props) {
  return (
    <div className={styles.list}>
      <div className={styles.header} role="row">
        {columns.map((column) => (
          <div key={column.key} className={`${styles.cell} ${styles.headerCell} ${column.className ?? ''}`}>
            {column.label}
          </div>
        ))}
      </div>

      <div className={styles.rows}>
        {rows.map((row) => {
          const content = (
            <>
              {columns.map((column) => (
                <div key={column.key} className={`${styles.cell} ${column.className ?? ''}`}>
                  {row.cells[column.key]}
                </div>
              ))}
            </>
          )

          if (row.href) {
            return (
              <a key={row.id} href={row.href} className={styles.row}>
                {content}
              </a>
            )
          }

          return (
            <button key={row.id} type="button" className={styles.row} onClick={row.onClick}>
              {content}
            </button>
          )
        })}
      </div>
    </div>
  )
}
