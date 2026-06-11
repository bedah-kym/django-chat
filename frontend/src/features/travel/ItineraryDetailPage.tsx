import { Link, useParams } from 'react-router-dom'
import { useTravelStore } from '@/stores/travelStore'
import { formatCurrency } from '@/utils/format'
import styles from './TravelPages.module.css'

export function ItineraryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const itineraries = useTravelStore((s) => s.itineraries)
  const itinerary = itineraries.find((item) => item.id === Number(id))

  if (!itinerary) return <div>Trip not found</div>

  return (
    <div className={styles.travel}>
      <Link to="/app/ops/travel/itineraries" className={styles.backLink}>Back to trips</Link>
      <div className={styles.detailHeader}>
        <h2 className={styles.pageTitle}>{itinerary.name}</h2>
        <span className={`${styles.statusBadge} ${styles[itinerary.status]}`}>{itinerary.status}</span>
      </div>
      <p className={styles.detailMeta}>Destination {itinerary.destination} · Dates {itinerary.startDate} to {itinerary.endDate}</p>

      <div className={styles.timeline}>
        {itinerary.items.map((item) => (
          <div key={item.id} className={styles.timelineItem}>
            <div className={styles.timelineDot} />
            <div className={styles.timelineCard}>
              <div className={styles.timelineHeader}>
                <span className={styles.timelineType}>{item.type}</span>
                <span className={styles.timelineDate}>{item.date} {item.time ? `at ${item.time}` : ''}</span>
              </div>
              <h4 className={styles.timelineName}>{item.name}</h4>
              <p className={styles.timelineLocation}>Location {item.location}</p>
              <div className={styles.timelineFooter}>
                <span className={`${styles.statusBadge} ${styles[item.status]}`}>{item.status}</span>
                <span>{formatCurrency(item.cost)}</span>
              </div>
            </div>
          </div>
        ))}
        {itinerary.items.length === 0 ? (
          <p className={styles.emptyText}>No items yet. Start planning your trip!</p>
        ) : null}
      </div>

      {itinerary.totalCost > 0 ? (
        <div className={styles.totalRow}>
          <span>Total Cost</span>
          <strong>{formatCurrency(itinerary.totalCost)}</strong>
        </div>
      ) : null}
    </div>
  )
}
