import { Link } from 'react-router-dom'
import { mockWallet, mockInvoices } from '@/mocks/payments'
import { mockItineraries } from '@/mocks/travel'
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
          <div className={styles.value}>KES {mockWallet.balance.toLocaleString()}</div>
          <p className={styles.description}>Wallet, invoices, reminders, and travel stay grouped together in one operational workspace.</p>
        </div>
      </div>

      <div className={styles.grid}>
        <section className={styles.card}>
          <div className={styles.sectionHeader}>
            <h2>Wallet</h2>
            <Link to="/app/ops/wallet" className={styles.linkBtn}>Open</Link>
          </div>
          <div className={styles.metric}>KES {mockWallet.balance.toLocaleString()}</div>
        </section>

        <section className={styles.card}>
          <div className={styles.sectionHeader}>
            <h2>Invoices</h2>
            <Link to="/app/ops/wallet" className={styles.linkBtn}>Open</Link>
          </div>
          <div className={styles.metric}>{mockInvoices.length} invoice records</div>
        </section>

        <section className={styles.card}>
          <div className={styles.sectionHeader}>
            <h2>Travel</h2>
            <Link to="/app/ops/travel/itineraries" className={styles.linkBtn}>Open</Link>
          </div>
          <div className={styles.metric}>{mockItineraries.length} planned trips</div>
        </section>

        <section className={styles.card}>
          <div className={styles.sectionHeader}>
            <h2>Ops Rooms</h2>
          </div>
          {opsRooms.map((room) => (
            <Link key={room.id} to={getRoomPath(room)} className={styles.row}>
              <span>{room.displayName}</span>
              <span className={styles.secondary}>{room.unreadCount} unread</span>
            </Link>
          ))}
        </section>
      </div>
    </div>
  )
}
