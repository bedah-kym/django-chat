import { Link } from 'react-router-dom'
import { mockEngagements, mockFindings } from '@/mocks/pentest'
import { mockPrograms, mockReports } from '@/mocks/bugBounty'
import { useChatStore } from '@/stores/chatStore'
import { getRoomPath } from '@/domains'
import styles from './SecurityDomainPage.module.css'

export function SecurityDomainPage() {
  const rooms = useChatStore((s) => s.rooms)
  const securityRooms = rooms.filter((room) => room.domain === 'security')

  return (
    <div className={styles.page}>
      <div className={styles.statsRow}>
        <div className={styles.statCard}><strong>{mockEngagements.length}</strong><span>Engagements</span></div>
        <div className={styles.statCard}><strong>{mockFindings.length}</strong><span>Findings</span></div>
        <div className={styles.statCard}><strong>{mockReports.length}</strong><span>Reports</span></div>
        <div className={styles.statCard}><strong>{mockPrograms.length}</strong><span>Programs</span></div>
      </div>

      <div className={styles.grid}>
        <section className={styles.card}>
          <div className={styles.sectionHeader}>
            <h2>Pentest</h2>
            <Link to="/app/security/pentest" className={styles.linkBtn}>Open</Link>
          </div>
          {mockEngagements.slice(0, 3).map((item) => (
            <Link key={item.id} to={`/app/security/pentest/${item.id}`} className={styles.row}>
              <span className={styles.primary}>{item.target}</span>
              <span className={styles.secondary}>{item.phase}</span>
            </Link>
          ))}
        </section>

        <section className={styles.card}>
          <div className={styles.sectionHeader}>
            <h2>Bug Bounty</h2>
            <Link to="/app/security/bugbounty" className={styles.linkBtn}>Open</Link>
          </div>
          {mockReports.slice(0, 3).map((item) => (
            <Link key={item.id} to="/app/security/bugbounty/reports" className={styles.row}>
              <span className={styles.primary}>{item.title}</span>
              <span className={styles.secondary}>{item.status}</span>
            </Link>
          ))}
        </section>

        <section className={styles.card}>
          <div className={styles.sectionHeader}>
            <h2>Security Rooms</h2>
          </div>
          {securityRooms.map((room) => (
            <Link key={room.id} to={getRoomPath(room)} className={styles.row}>
              <span className={styles.primary}>{room.displayName}</span>
              <span className={styles.secondary}>{room.unreadCount} unread</span>
            </Link>
          ))}
        </section>

        <section className={styles.card}>
          <div className={styles.sectionHeader}>
            <h2>Review Queue</h2>
          </div>
          {mockFindings.slice(0, 3).map((item) => (
            <Link key={item.id} to={`/app/security/pentest/${item.engagementId}`} className={styles.row}>
              <span className={styles.primary}>{item.title}</span>
              <span className={styles.secondary}>{item.severity}</span>
            </Link>
          ))}
        </section>
      </div>
    </div>
  )
}
