import { CalendarClock, CheckCircle2 } from 'lucide-react'
import { formatDate } from '@/utils/format'
import styles from './RemindersPage.module.css'

const mockReminders = [
  { id: 1, title: 'Follow up with Mombasa client', dueDate: '2026-04-04T10:00:00Z', status: 'pending' as const },
  { id: 2, title: 'Review Q2 roadmap draft', dueDate: '2026-04-04T14:00:00Z', status: 'pending' as const },
  { id: 3, title: 'Send monthly report to stakeholders', dueDate: '2026-04-05T09:00:00Z', status: 'pending' as const },
  { id: 4, title: 'Renew Calendly subscription', dueDate: '2026-04-10T00:00:00Z', status: 'pending' as const },
  { id: 5, title: 'Prepare onboarding materials', dueDate: '2026-04-01T09:00:00Z', status: 'completed' as const },
]

export function RemindersPage() {
  const pending = mockReminders.filter((reminder) => reminder.status === 'pending')
  const completed = mockReminders.filter((reminder) => reminder.status === 'completed')

  return (
    <div className={styles.workspacePage}>
      <section className={styles.hero}>
        <div>
          <div className={styles.eyebrow}>Schedule</div>
          <h1 className={styles.title}>Reminders</h1>
          <p className={styles.description}>Keep upcoming obligations visible without leaving the workspace.</p>
        </div>
        <button className={styles.addBtn}>New Reminder</button>
      </section>

      <div className={styles.columns}>
        <section className={styles.column}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Upcoming</h2>
              <p>{pending.length} active reminders</p>
            </div>
            <CalendarClock size={16} />
          </div>
          <div className={styles.list}>
            {pending.map((reminder) => (
              <div key={reminder.id} className={styles.item}>
                <button className={styles.checkbox} aria-label={`Mark ${reminder.title} complete`} />
                <div className={styles.itemContent}>
                  <div className={styles.itemTitle}>{reminder.title}</div>
                  <div className={styles.itemDate}>{formatDate(reminder.dueDate, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.column}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Completed</h2>
              <p>{completed.length} cleared items</p>
            </div>
            <CheckCircle2 size={16} />
          </div>
          <div className={styles.list}>
            {completed.map((reminder) => (
              <div key={reminder.id} className={`${styles.item} ${styles.done}`}>
                <button className={`${styles.checkbox} ${styles.checked}`} aria-label={`${reminder.title} completed`}>✓</button>
                <div className={styles.itemContent}>
                  <div className={styles.itemTitle}>{reminder.title}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
