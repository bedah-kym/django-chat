import { Link } from 'react-router-dom'
import { useTravelStore } from '@/stores/travelStore'
import { formatCurrency } from '@/utils/format'
import styles from './TravelPages.module.css'

export function ItineraryListPage() {
  const itineraries = useTravelStore((s) => s.itineraries)

  return (
    <div className={styles.travel}>
      <div className={styles.header}>
        <h2 className={styles.pageTitle}>My Trips</h2>
        <Link to="/app/ops/travel/plan" className={styles.btnPrimary}>+ Plan New Trip</Link>
      </div>
      <div className={styles.grid}>
        {itineraries.map((itinerary) => (
          <Link key={itinerary.id} to={`/app/ops/travel/${itinerary.id}`} className={styles.card}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>{itinerary.name}</h3>
              <span className={`${styles.statusBadge} ${styles[itinerary.status]}`}>{itinerary.status}</span>
            </div>
            <div className={styles.cardMeta}>
              <span>Destination: {itinerary.destination}</span>
              <span>Dates: {itinerary.startDate} to {itinerary.endDate}</span>
            </div>
            <div className={styles.cardFooter}>
              <span>{itinerary.items.length} items</span>
              {itinerary.totalCost > 0 ? <span>{formatCurrency(itinerary.totalCost)}</span> : null}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
