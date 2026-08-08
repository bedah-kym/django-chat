import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plane, Plus, MapPin, Calendar, Compass } from 'lucide-react'
import { useTravelStore } from '@/stores/travelStore'
import { formatCurrency } from '@/utils/format'
import { useDelayedFlag } from '@/hooks/useDelayedFlag'
import { ItineraryListSkeleton } from '@/components/ui/ItineraryListSkeleton'
import type { Itinerary } from '@/types/travel'
import {
  tone, isActive, isUpcoming, isPast,
  formatDateRange, relativeWindow, daysBetween,
} from './utils'
import './travel.tokens.css'
import styles from './ItineraryListPage.module.css'

function TripCard({ trip, lifted = false }: { trip: Itinerary; lifted?: boolean }) {
  const t = tone(trip.destination || trip.name)
  const days = daysBetween(trip.startDate, trip.endDate)
  return (
    <motion.div
      layout
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 280, damping: 26 }}
      className={`${styles.card} ${lifted ? styles.cardLifted : ''}`}
      data-tone={t}
    >
      <Link to={`/app/travel/${trip.id}`} className={styles.cardLink}>
        <div className={styles.cardHero} aria-hidden>
          <div className={styles.cardHeroMesh} />
        </div>
        <div className={styles.cardBody}>
          {lifted ? <span className={styles.todayTag}>Today</span> : null}
          <div className={styles.cardTitleRow}>
            <h3 className={styles.cardDestination}>{trip.destination || trip.name}</h3>
            <span className={styles.cardWindow}>{relativeWindow(trip)}</span>
          </div>
          <div className={styles.cardMeta}>
            <span className={styles.metaItem}>
              <Calendar size={13} />
              {formatDateRange(trip.startDate, trip.endDate)}
            </span>
            <span className={styles.metaDot} aria-hidden>·</span>
            <span className={styles.metaItem}>{days} {days === 1 ? 'day' : 'days'}</span>
            <span className={styles.metaDot} aria-hidden>·</span>
            <span className={styles.metaItem}>{trip.items.length} bookings</span>
          </div>
          {trip.totalCost > 0 ? (
            <div className={styles.cardCost}>{formatCurrency(trip.totalCost)}</div>
          ) : null}
        </div>
      </Link>
    </motion.div>
  )
}

export function ItineraryListPage() {
  const itineraries = useTravelStore((s) => s.itineraries)
  const isLoading = useTravelStore((s) => s.isLoading)
  const initialize = useTravelStore((s) => s.initialize)
  const showSkeleton = useDelayedFlag(isLoading && itineraries.length === 0)

  useEffect(() => { initialize() }, [initialize])

  const active = itineraries.filter(isActive)
  const upcoming = itineraries.filter(isUpcoming).sort((a, b) => a.startDate.localeCompare(b.startDate))
  const past = itineraries.filter(isPast).sort((a, b) => b.endDate.localeCompare(a.endDate))

  return (
    <div className="tv">
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Travel</p>
            <h1 className={styles.title}>Your trips</h1>
            <p className={styles.subtitle}>
              {itineraries.length === 0
                ? 'Plan your first trip — Mathia will assemble flights, stays, and the things worth doing.'
                : `${itineraries.length} ${itineraries.length === 1 ? 'trip' : 'trips'} on the books.`}
            </p>
          </div>
          <Link to="/app/travel/plan" className={styles.planBtn}>
            <Plus size={16} />
            Plan a trip
          </Link>
        </header>

        {isLoading && itineraries.length === 0 ? (
          showSkeleton ? <ItineraryListSkeleton /> : null
        ) : itineraries.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <Compass size={28} strokeWidth={1.5} />
            </div>
            <h2 className={styles.emptyTitle}>Where to next?</h2>
            <p className={styles.emptyBody}>
              Tell Mathia a destination and a date. She'll search flights, stays,
              and things worth doing — and lay them out as a single itinerary.
            </p>
            <Link to="/app/travel/plan" className={styles.planBtn}>
              <Plus size={16} />
              Plan a trip
            </Link>
          </div>
        ) : (
          <>
            {active.length > 0 ? (
              <section className={styles.section}>
                <div className={styles.cards}>
                  {active.map((trip) => (
                    <TripCard key={trip.id} trip={trip} lifted />
                  ))}
                </div>
              </section>
            ) : null}

            {upcoming.length > 0 ? (
              <section className={styles.section}>
                <div className={styles.sectionHead}>
                  <Plane size={15} strokeWidth={1.9} className={styles.sectionIcon} />
                  <span className={styles.sectionLabel}>Upcoming</span>
                  <span className={styles.sectionCount}>{upcoming.length}</span>
                </div>
                <div className={styles.cards}>
                  {upcoming.map((trip) => <TripCard key={trip.id} trip={trip} />)}
                </div>
              </section>
            ) : null}

            {past.length > 0 ? (
              <section className={styles.section}>
                <div className={styles.sectionHead}>
                  <MapPin size={15} strokeWidth={1.9} className={styles.sectionIcon} />
                  <span className={styles.sectionLabel}>Past trips</span>
                  <span className={styles.sectionCount}>{past.length}</span>
                </div>
                <div className={styles.cards}>
                  {past.map((trip) => <TripCard key={trip.id} trip={trip} />)}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
