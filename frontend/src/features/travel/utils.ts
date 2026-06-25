import type { Itinerary, ItineraryItem } from '@/types/travel'

/** Deterministic 0..5 tone index from a string (destination, title, etc.). */
export function tone(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return Math.abs(h) % 6
}

/** Today's date in YYYY-MM-DD using the local zone. */
export function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Inclusive day count between two YYYY-MM-DD strings. */
export function daysBetween(startISO: string, endISO: string): number {
  if (!startISO || !endISO) return 0
  const a = new Date(startISO).getTime()
  const b = new Date(endISO).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.max(1, Math.round((b - a) / 86400000) + 1)
}

/** Is "today" inside [start, end] inclusive? */
export function isActive(it: Itinerary): boolean {
  const t = todayISO()
  return it.startDate <= t && t <= it.endDate
}

/** Trip is upcoming if start is strictly in the future. */
export function isUpcoming(it: Itinerary): boolean {
  return it.startDate > todayISO()
}

/** Trip ended if end strictly before today. */
export function isPast(it: Itinerary): boolean {
  return it.endDate < todayISO()
}

/** "Mar 12 — Mar 19" style range, omits year when same as today. */
export function formatDateRange(startISO: string, endISO: string): string {
  try {
    const a = new Date(startISO)
    const b = new Date(endISO)
    const sameYear = a.getFullYear() === b.getFullYear()
    const sameMonth = sameYear && a.getMonth() === b.getMonth()
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
    const left = a.toLocaleDateString(undefined, opts)
    const right = sameMonth
      ? b.getDate()
      : b.toLocaleDateString(undefined, opts)
    const year =
      a.getFullYear() === new Date().getFullYear() ? '' : ` ${a.getFullYear()}`
    return `${left} — ${right}${year}`
  } catch {
    return `${startISO} — ${endISO}`
  }
}

/** Friendly "in 3 days" / "today" / "ended" string. */
export function relativeWindow(it: Itinerary): string {
  const today = todayISO()
  if (isActive(it)) return 'In progress'
  if (it.startDate > today) {
    const days = daysBetween(today, it.startDate) - 1
    if (days === 0) return 'Tomorrow'
    if (days === 1) return 'In 1 day'
    return `In ${days} days`
  }
  return 'Ended'
}

/** Group items by ISO date for the day timeline. */
export function groupItemsByDate(items: ItineraryItem[]): Array<{ date: string; items: ItineraryItem[] }> {
  const map = new Map<string, ItineraryItem[]>()
  for (const it of items) {
    const list = map.get(it.date) || []
    list.push(it)
    map.set(it.date, list)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({
      date,
      items: items.sort((a, b) => (a.time || '').localeCompare(b.time || '')),
    }))
}

/** Long-form day header: "Wednesday, Mar 13" */
export function formatDayHeader(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}
