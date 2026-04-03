import styles from './RemindersPage.module.css'

const mockReminders = [
  { id: 1, title: 'Follow up with Mombasa client', dueDate: '2026-04-04T10:00:00Z', status: 'pending' as const },
  { id: 2, title: 'Review Q2 roadmap draft', dueDate: '2026-04-04T14:00:00Z', status: 'pending' as const },
  { id: 3, title: 'Send monthly report to stakeholders', dueDate: '2026-04-05T09:00:00Z', status: 'pending' as const },
  { id: 4, title: 'Renew Calendly subscription', dueDate: '2026-04-10T00:00:00Z', status: 'pending' as const },
  { id: 5, title: 'Prepare onboarding materials', dueDate: '2026-04-01T09:00:00Z', status: 'completed' as const },
]

export function RemindersPage() {
  const pending = mockReminders.filter(r => r.status === 'pending')
  const completed = mockReminders.filter(r => r.status === 'completed')

  return (
    <div className={styles.reminders}>
      <div className={styles.header}>
        <h2>Upcoming</h2>
        <button className={styles.addBtn}>+ New Reminder</button>
      </div>
      <div className={styles.list}>
        {pending.map(r => (
          <div key={r.id} className={styles.item}>
            <button className={styles.checkbox} />
            <div className={styles.itemContent}>
              <div className={styles.itemTitle}>{r.title}</div>
              <div className={styles.itemDate}>Due {new Date(r.dueDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
            </div>
          </div>
        ))}
      </div>
      <h3 className={styles.subHeader}>Completed</h3>
      <div className={styles.list}>
        {completed.map(r => (
          <div key={r.id} className={`${styles.item} ${styles.done}`}>
            <button className={`${styles.checkbox} ${styles.checked}`}>✓</button>
            <div className={styles.itemContent}>
              <div className={styles.itemTitle}>{r.title}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
