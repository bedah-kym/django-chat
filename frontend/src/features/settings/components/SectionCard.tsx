import styles from './SectionCard.module.css'

interface Props {
  title: string
  children: React.ReactNode
}

export function SectionCard({ title, children }: Props) {
  return (
    <div className={styles.card}>
      <h3 className={styles.title}>{title}</h3>
      <div className={styles.body}>{children}</div>
    </div>
  )
}
