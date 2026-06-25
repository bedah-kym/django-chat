import { Link } from 'react-router-dom'
import { useChatStore } from '@/stores/chatStore'
import { getRoomPath } from '@/domains'
import styles from './OpsDomainPage.module.css'

export function OpsDomainPage() {
  const rooms = useChatStore((s) => s.rooms)
  const opsRooms = rooms.filter((room) => room.domain === 'ops')

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div>
          <div className={styles.label}>Business/Ops</div>
          <div className={styles.value}>{opsRooms.length} active {opsRooms.length === 1 ? 'room' : 'rooms'}</div>
          <p className={styles.description}>Day-to-day operations: rooms, reminders, and follow-through. Personal utilities like Travel and Payments live in your user menu.</p>
        </div>
      </div>

      <div className={styles.grid}>
        <section className={styles.card}>
          <div className={styles.sectionHeader}>
            <h2>Reminders</h2>
            <Link to="/app/ops/reminders" className={styles.linkBtn}>Open</Link>
          </div>
          <div className={styles.metric}>Stay on top of follow-ups</div>
        </section>

        <section className={styles.card}>
          <div className={styles.sectionHeader}>
            <h2>Ops Rooms</h2>
          </div>
          {opsRooms.length === 0 ? (
            <div className={styles.secondary}>No ops rooms yet.</div>
          ) : (
            opsRooms.map((room) => (
              <Link key={room.id} to={getRoomPath(room)} className={styles.row}>
                <span>{room.displayName}</span>
                <span className={styles.secondary}>{room.unreadCount} unread</span>
              </Link>
            ))
          )}
        </section>
      </div>
    </div>
  )
}
