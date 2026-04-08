import { Link } from 'react-router-dom'
import { mockItineraries } from '@/mocks/travel'
import styles from './TravelPages.module.css'

export function ItineraryListPage() {
  return (
    <div className={styles.travel}>
      <div className={styles.header}>
        <h2 className={styles.pageTitle}>My Trips</h2>
        <Link to="/app/ops/travel/plan" className={styles.btnPrimary}>+ Plan New Trip</Link>
      </div>
      <div className={styles.grid}>
        {mockItineraries.map(it => (
          <Link key={it.id} to={`/app/ops/travel/${it.id}`} className={styles.card}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>{it.name}</h3>
              <span className={`${styles.statusBadge} ${styles[it.status]}`}>{it.status}</span>
            </div>
            <div className={styles.cardMeta}>
              <span>📍 {it.destination}</span>
              <span>📅 {it.startDate} — {it.endDate}</span>
            </div>
            <div className={styles.cardFooter}>
              <span>{it.items.length} items</span>
              {it.totalCost > 0 && <span>KES {it.totalCost.toLocaleString()}</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
