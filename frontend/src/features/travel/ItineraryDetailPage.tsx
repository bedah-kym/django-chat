import { useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  ChevronLeft, ChevronDown, Calendar, Clock, MapPin, Plane, Hotel, Bus, Car, Music,
  Mountain, Share2, Archive, Plus, X, Trash2, ExternalLink, Ticket,
} from 'lucide-react'
import { useTravelStore } from '@/stores/travelStore'
import { formatCurrency } from '@/utils/format'
import type { ItineraryItem } from '@/types/travel'
import { TripChatPanel } from './TripChatPanel'
import {
  tone, todayISO, formatDateRange, daysBetween, formatDayHeader,
  groupItemsByDate, relativeWindow,
} from './utils'
import './travel.tokens.css'
import styles from './ItineraryDetailPage.module.css'

const ITEM_TYPES: ItineraryItem['type'][] = ['flight', 'hotel', 'bus', 'transfer', 'event', 'activity']

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

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={styles.detailField}>
      <dt className={styles.detailLabel}>{label}</dt>
      <dd className={styles.detailValue}>{value}</dd>
    </div>
  )
}

function ItemRow({
  item, onRemove, onBook,
}: {
  item: ItineraryItem
  onRemove: (item: ItineraryItem) => Promise<void>
  onBook: (item: ItineraryItem) => void
}) {
  const Icon = TYPE_ICON[item.type] || Plane
  const [confirming, setConfirming] = useState(false)
  const [removing, setRemoving] = useState(false)
  const booking = item.booking
  const isBooked = item.status === 'booked' || Boolean(booking)
  const canBook = !isBooked && Boolean(item.bookingLink)
  // Something extra worth revealing beyond the always-visible summary row.
  const hasDetails = Boolean(
    item.details || item.provider || item.endTime || item.bookingUrl || booking,
  )
  const [expanded, setExpanded] = useState(false)

  const handleConfirm = async () => {
    if (removing) return
    setRemoving(true)
    try {
      await onRemove(item)
      // Row unmounts on success — no further state update needed.
    } catch {
      setRemoving(false)
      setConfirming(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: -12 }}
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
            <div className={styles.itemActions}>
              {hasDetails ? (
                <button
                  type="button"
                  className={styles.itemExpandBtn}
                  onClick={() => setExpanded((v) => !v)}
                  aria-expanded={expanded}
                  aria-label={expanded ? 'Hide details' : 'Show details'}
                >
                  <ChevronDown size={15} className={expanded ? styles.chevUp : ''} />
                </button>
              ) : null}
              {confirming ? (
                <>
                  <button
                    type="button"
                    className={styles.itemRemoveConfirm}
                    onClick={handleConfirm}
                    disabled={removing}
                  >
                    {removing ? 'Removing…' : 'Remove'}
                  </button>
                  <button
                    type="button"
                    className={styles.itemRemoveCancel}
                    onClick={() => setConfirming(false)}
                    disabled={removing}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={styles.itemRemoveBtn}
                  onClick={() => setConfirming(true)}
                  aria-label={`Remove ${item.name}`}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            className={styles.itemNameBtn}
            onClick={() => hasDetails && setExpanded((v) => !v)}
          >
            <h4 className={styles.itemName}>{item.name}</h4>
          </button>
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
            {canBook && item.bookingLink ? (
              <a
                className={styles.bookBtn}
                href={item.bookingLink.url}
                target="_blank"
                rel="noreferrer"
                onClick={() => onBook(item)}
              >
                Book on {item.bookingLink.provider} <ExternalLink size={12} />
              </a>
            ) : null}
          </div>

          <AnimatePresence initial={false}>
            {expanded && hasDetails ? (
              <motion.div
                key="details"
                className={styles.itemDetailsPanel}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                {item.details ? <p className={styles.itemDetails}>{item.details}</p> : null}

                <dl className={styles.detailGrid}>
                  {item.provider ? <DetailField label="Provider" value={item.provider} /> : null}
                  {item.time ? <DetailField label="Departs" value={item.time} /> : null}
                  {item.endTime ? <DetailField label="Ends" value={item.endTime} /> : null}
                  {item.cost > 0 ? <DetailField label="Price" value={formatCurrency(item.cost)} /> : null}
                </dl>

                {booking ? (
                  <div className={styles.bookingBox}>
                    <div className={styles.bookingHead}>
                      <Ticket size={14} />
                      <span>Booking</span>
                      <span className={`${styles.bookingStatus} ${styles[`status_${booking.status}`] || ''}`}>
                        {booking.status}
                      </span>
                    </div>
                    <dl className={styles.detailGrid}>
                      {booking.confirmationCode ? (
                        <DetailField label="Confirmation" value={<code>{booking.confirmationCode}</code>} />
                      ) : null}
                      {booking.bookingReference ? (
                        <DetailField label="Reference" value={<code>{booking.bookingReference}</code>} />
                      ) : null}
                      <DetailField label="Provider booking ID" value={<code>{booking.providerBookingId}</code>} />
                      {booking.confirmationEmail ? (
                        <DetailField label="Sent to" value={booking.confirmationEmail} />
                      ) : null}
                    </dl>
                    {booking.bookingUrl ? (
                      <a className={styles.bookingLink} href={booking.bookingUrl} target="_blank" rel="noreferrer">
                        Complete booking on {booking.provider} <ExternalLink size={12} />
                      </a>
                    ) : null}
                  </div>
                ) : item.bookingUrl ? (
                  <a className={styles.bookingLink} href={item.bookingUrl} target="_blank" rel="noreferrer">
                    Open booking link <ExternalLink size={12} />
                  </a>
                ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

interface AddBookingModalProps {
  tripId: number
  defaultDate: string
  minDate: string
  maxDate: string
  onClose: () => void
}

function AddBookingModal({ tripId, defaultDate, minDate, maxDate, onClose }: AddBookingModalProps) {
  const addItem = useTravelStore((s) => s.addItem)
  const dateRef = useRef<HTMLInputElement>(null)

  const [type, setType] = useState<ItineraryItem['type']>('flight')
  const [name, setName] = useState('')
  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')
  const [cost, setCost] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = name.trim().length >= 2 && !!date

  const openDatePicker = () => {
    const el = dateRef.current
    if (!el) return
    el.focus()
    type PickerInput = HTMLInputElement & { showPicker?: () => void }
    const withPicker = el as PickerInput
    if (typeof withPicker.showPicker === 'function') {
      try { withPicker.showPicker() } catch { /* picker already open or unsupported */ }
    }
  }

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    try {
      await addItem(tripId, {
        item_type: type,
        title: name.trim(),
        start_datetime: `${date}T${time || '00:00'}:00`,
        location_name: location.trim() || undefined,
        price_ksh: cost.trim() ? cost.trim() : undefined,
        status: 'booked',
      })
      toast.success('Booking added')
      onClose()
    } catch {
      toast.error('Could not add booking')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      className={styles.modalOverlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
    >
      <motion.div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Add a booking"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHead}>
          <h3 className={styles.modalTitle}>Add a booking</h3>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.typeGrid}>
            {ITEM_TYPES.map((t) => {
              const Icon = TYPE_ICON[t]
              const active = t === type
              return (
                <button
                  key={t}
                  type="button"
                  className={`${styles.typeChip} ${active ? styles.typeChipActive : ''}`}
                  onClick={() => setType(t)}
                >
                  <Icon size={15} strokeWidth={1.9} />
                  {TYPE_LABEL[t]}
                </button>
              )
            })}
          </div>

          <label className={styles.modalField}>
            <span className={styles.modalLabel}>Name</span>
            <input
              autoFocus
              className={styles.modalInput}
              placeholder="e.g. KQ 100 to Nairobi"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) handleSubmit() }}
            />
          </label>

          <div className={styles.modalRow}>
            <label className={styles.modalField}>
              <span className={styles.modalLabel}>Date</span>
              <div className={styles.modalInputWrap} onClick={openDatePicker} role="button" tabIndex={-1}>
                <Calendar size={15} className={styles.modalInputIcon} />
                <input
                  ref={dateRef}
                  type="date"
                  className={styles.modalInputBare}
                  min={minDate}
                  max={maxDate}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </label>
            <label className={styles.modalField}>
              <span className={styles.modalLabel}>Time <span className={styles.modalOptional}>· optional</span></span>
              <div className={styles.modalInputWrap}>
                <Clock size={15} className={styles.modalInputIcon} />
                <input
                  type="time"
                  className={styles.modalInputBare}
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </label>
          </div>

          <label className={styles.modalField}>
            <span className={styles.modalLabel}>Location <span className={styles.modalOptional}>· optional</span></span>
            <input
              className={styles.modalInput}
              placeholder="e.g. JKIA, Terminal 1A"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </label>

          <label className={styles.modalField}>
            <span className={styles.modalLabel}>Cost (KES) <span className={styles.modalOptional}>· optional</span></span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              className={styles.modalInput}
              placeholder="0"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
          </label>
        </div>

        <div className={styles.modalFoot}>
          <button type="button" className={styles.modalCancel} onClick={onClose}>Cancel</button>
          <button
            type="button"
            className={styles.modalSubmit}
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? 'Adding…' : 'Add booking'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export function ItineraryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const trip = useTravelStore((s) => s.itineraries.find((it) => it.id === Number(id)))
  const removeItem = useTravelStore((s) => s.removeItem)
  const bookItem = useTravelStore((s) => s.bookItem)

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
  const [showAdd, setShowAdd] = useState(false)
  // null = follow the default (collapsed when the trip already has bookings,
  // open when it's empty so the assistant is the obvious next step).
  const [chatCollapsedOverride, setChatCollapsedOverride] = useState<boolean | null>(null)

  if (!trip) {
    return (
      <div className="tv">
        <div className={styles.notFound}>
          <p className={styles.notFoundCopy}>Trip not found.</p>
          <Link to="/app/travel/itineraries" className={styles.notFoundLink}>← Back to trips</Link>
        </div>
      </div>
    )
  }

  const itemsForDay = (date: string | null) =>
    groups.find((g) => g.date === date)?.items ?? []

  const totalDays = daysBetween(trip.startDate, trip.endDate)
  const t = tone(trip.destination || trip.name)
  const chatCollapsed = chatCollapsedOverride ?? trip.items.length > 0

  const handleRemove = async (item: ItineraryItem) => {
    try {
      await removeItem(trip.id, item.id)
      toast.success(`Removed ${item.name} from your trip`)
    } catch {
      toast.error('Could not remove booking')
      throw new Error('remove failed') // let ItemRow reset its confirm state
    }
  }

  // The provider checkout opens via the anchor itself; this records the handoff
  // (marks the item booked + saves the link) in the background.
  const handleBook = (item: ItineraryItem) => {
    bookItem(trip.id, item.id)
      .then(() => toast.success(`Opening ${item.bookingLink?.provider ?? 'provider'} to complete your booking`))
      .catch(() => toast.error('Could not record the booking'))
  }

  return (
    <div className="tv">
      <div className={styles.page} data-tone={t}>
        <Link to="/app/travel/itineraries" className={styles.back}>
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

        <div className={`${styles.body} ${chatCollapsed ? styles.bodyChatCollapsed : styles.bodyChatOpen}`}>
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
              <button className={styles.addBtn} type="button" onClick={() => setShowAdd(true)}>
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
                <AnimatePresence initial={false}>
                  {itemsForDay(selectedDay).map((item) => (
                    <ItemRow key={item.id} item={item} onRemove={handleRemove} onBook={handleBook} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </main>

          <TripChatPanel
            tripId={trip.id}
            collapsed={chatCollapsed}
            onToggle={() => setChatCollapsedOverride(!chatCollapsed)}
          />
        </div>
      </div>

      <AnimatePresence>
        {showAdd ? (
          <AddBookingModal
            tripId={trip.id}
            defaultDate={selectedDay ?? trip.startDate}
            minDate={trip.startDate}
            maxDate={trip.endDate}
            onClose={() => setShowAdd(false)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  )
}
