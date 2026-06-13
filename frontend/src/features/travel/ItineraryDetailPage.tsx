import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ChevronLeft, Calendar, MapPin, Plane, Hotel, Bus, Car, Music,
  Mountain, Share2, Archive, Plus,
} from 'lucide-react'
import { useTravelStore } from '@/stores/travelStore'
import { formatCurrency } from '@/utils/format'
import type { ItineraryItem } from '@/types/travel'
import {
  tone, todayISO, formatDateRange, daysBetween, formatDayHeader,
  groupItemsByDate, relativeWindow,
} from './utils'
import './travel.tokens.css'
import styles from './ItineraryDetailPage.module.css'

const TYPE_ICON: Record<ItineraryItem['type'], typeof Plane> = {
  flight: Plane,
  hotel: Hotel,
  bus: Bus,
  transfer: Car,
  event: Music,
  activity: Mountain,
}

const TYPE_LABEL: Record<ItineraryItem['type'], string> = {
  flight: 'Flight',
  hotel: 'Stay',
  bus: 'Bus',
  transfer: 'Transfer',
  event: 'Event',
  activity: 'Activity',
}

function ItemRow({ item }: { item: ItineraryItem }) {
  const Icon = TYPE_ICON[item.type] || Plane
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={styles.itemRow}
    >
      <div className={styles.itemTime}>
        {item.time || <span className={styles.itemTimePlaceholder}>—</span>}
      </div>
      <div className={styles.itemCard}>
        <div className={styles.itemIcon}><Icon size={16} strokeWidth={1.9} /></div>
        <div className={styles.itemBody}>
          <div className={styles.itemTop}>
            <span className={styles.itemType}>{TYPE_LABEL[item.type]}</span>
            <span className={`${styles.itemStatus} ${styles[`status_${item.status}`] || ''}`}>
              {item.status}
            </span>
          </div>
          <h4 className={styles.itemName}>{item.name}</h4>
          <div className={styles.itemMeta}>
            {item.location ? (
              <span className={styles.itemMetaInline}>
                <MapPin size={12} />
                {item.location}
              </span>
            ) : null}
            {item.cost > 0 ? (
              <span className={styles.itemCost}>{formatCurrency(item.cost)}</span>
            ) : null}
          </div>
          {item.details ? <p className={styles.itemDetails}>{item.details}</p> : null}
        </div>
      </div>
    </motion.div>
  )
}

export function ItineraryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const trip = useTravelStore((s) => s.itineraries.find((it) => it.id === Number(id)))

  const groups = useMemo(() => trip ? groupItemsByDate(trip.items) : [], [trip])
  const allDays = useMemo(() => {
    if (!trip) return [] as string[]
    const days: string[] = []
    const total = daysBetween(trip.startDate, trip.endDate)
    const start = new Date(trip.startDate)
    for (let i = 0; i < total; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      days.push(`${y}-${m}-${day}`)
    }
    return days
  }, [trip])

  const today = todayISO()
  const initialDay = trip
    ? allDays.includes(today)
      ? today
      : (allDays[0] ?? trip.startDate)
    : null
  const [selectedDay, setSelectedDay] = useState<string | null>(initialDay)

  if (!trip) {
    return (
      <div className="tv">
        <div className={styles.notFound}>
          <p className={styles.notFoundCopy}>Trip not found.</p>
          <Link to="/app/ops/travel/itineraries" className={styles.notFoundLink}>← Back to trips</Link>
        </div>
      </div>
    )
  }

  const itemsForDay = (date: string | null) =>
    groups.find((g) => g.date === date)?.items ?? []

  const totalDays = daysBetween(trip.startDate, trip.endDate)
  const t = tone(trip.destination || trip.name)

  return (
    <div className="tv">
      <div className={styles.page} data-tone={t}>
        <Link to="/app/ops/travel/itineraries" className={styles.back}>
          <ChevronLeft size={16} />
          Trips
        </Link>

        <header className={styles.hero}>
          <div className={styles.heroMesh} aria-hidden />
          <div className={styles.heroBody}>
            <p className={styles.heroEyebrow}>{trip.status} · {relativeWindow(trip)}</p>
            <h1 className={styles.heroTitle}>{trip.destination || trip.name}</h1>
            <div className={styles.heroMeta}>
              <span className={styles.heroMetaItem}>
                <Calendar size={14} />
                {formatDateRange(trip.startDate, trip.endDate)}
              </span>
              <span className={styles.heroMetaDot} aria-hidden>·</span>
              <span className={styles.heroMetaItem}>{totalDays} {totalDays === 1 ? 'day' : 'days'}</span>
              <span className={styles.heroMetaDot} aria-hidden>·</span>
              <span className={styles.heroMetaItem}>{trip.items.length} bookings</span>
              {trip.totalCost > 0 ? (
                <>
                  <span className={styles.heroMetaDot} aria-hidden>·</span>
                  <span className={styles.heroMetaItem}>{formatCurrency(trip.totalCost)}</span>
                </>
              ) : null}
            </div>
          </div>
          <div className={styles.heroActions}>
            <button className={styles.heroAction} type="button">
              <Share2 size={14} /> Share
            </button>
            <button className={styles.heroAction} type="button">
              <Archive size={14} /> Archive
            </button>
          </div>
        </header>

        <div className={styles.body}>
          <aside className={styles.dayRail} aria-label="Trip days">
            <div className={styles.dayRailLabel}>Days</div>
            {allDays.map((date, idx) => {
              const count = itemsForDay(date).length
              const active = date === selectedDay
              const isToday = date === today
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setSelectedDay(date)}
                  className={`${styles.dayBtn} ${active ? styles.dayBtnActive : ''}`}
                >
                  <span className={styles.dayBtnIndex}>Day {idx + 1}</span>
                  <span className={styles.dayBtnDate}>{formatDayHeader(date)}</span>
                  <span className={styles.dayBtnRight}>
                    {isToday ? <span className={styles.dayTodayDot} aria-label="Today" /> : null}
                    {count > 0 ? <span className={styles.dayCount}>{count}</span> : null}
                  </span>
                </button>
              )
            })}
          </aside>

          <main className={styles.focus}>
            <div className={styles.focusHead}>
              <div>
                <p className={styles.focusEyebrow}>
                  {selectedDay === today ? 'Today' : selectedDay ? `Day ${allDays.indexOf(selectedDay) + 1}` : ''}
                </p>
                <h2 className={styles.focusTitle}>
                  {selectedDay ? formatDayHeader(selectedDay) : ''}
                </h2>
              </div>
              <button className={styles.addBtn} type="button">
                <Plus size={14} /> Add booking
              </button>
            </div>

            {itemsForDay(selectedDay).length === 0 ? (
              <div className={styles.focusEmpty}>
                <p className={styles.focusEmptyTitle}>Nothing booked yet for this day.</p>
                <p className={styles.focusEmptyBody}>
                  Add a flight, stay, or activity — or ask Mathia in chat for ideas.
                </p>
              </div>
            ) : (
              <div className={styles.itemList}>
                {itemsForDay(selectedDay).map((item) => (
                  <ItemRow key={item.id} item={item} />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
