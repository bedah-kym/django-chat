import { create } from 'zustand'
import type { Itinerary, ItineraryItem } from '@/types/travel'
import { fetchItineraries, createItineraryItem, deleteItineraryItem, bookItineraryItem } from '@/api/travel'
import type { ItineraryResponse, CreateItineraryItemInput } from '@/api/travel'

function mapStatus(status: string): Itinerary['status'] {
  switch (status) {
    case 'draft': return 'planning'
    case 'active': return 'confirmed'
    case 'completed': return 'completed'
    case 'archived': return 'archived'
    default: return 'planning'
  }
}

function mapItem(item: ItineraryResponse['items'][0]): ItineraryItem {
  const date = item.start_datetime ? item.start_datetime.slice(0, 10) : ''
  const time = item.start_datetime ? item.start_datetime.slice(11, 16) : undefined
  const endTime = item.end_datetime ? item.end_datetime.slice(11, 16) : undefined
  const b = item.booking
  return {
    id: item.id,
    type: item.item_type as ItineraryItem['type'],
    name: item.title,
    date,
    time,
    endTime,
    location: item.location_name ?? '',
    cost: item.price_ksh ? Number(item.price_ksh) : 0,
    currency: item.price_currency ?? 'KES',
    status: item.status as ItineraryItem['status'],
    details: item.description ?? undefined,
    provider: item.provider ?? undefined,
    bookingUrl: item.booking_url ?? undefined,
    bookingLink: item.booking_link ?? undefined,
    booking: b
      ? {
          provider: b.provider,
          providerBookingId: b.provider_booking_id,
          bookingReference: b.booking_reference,
          confirmationCode: b.confirmation_code,
          status: b.status,
          bookingUrl: b.booking_url,
          confirmationEmail: b.confirmation_email,
          bookedAt: b.booked_at,
          confirmedAt: b.confirmed_at,
        }
      : null,
  }
}

function mapItinerary(i: ItineraryResponse): Itinerary {
  return {
    id: i.id,
    name: i.title,
    destination: (i.metadata && typeof i.metadata === 'object' && i.metadata.destination as string) || i.region,
    startDate: i.start_date ? i.start_date.slice(0, 10) : '',
    endDate: i.end_date ? i.end_date.slice(0, 10) : '',
    status: mapStatus(i.status),
    items: (i.items ?? []).map(mapItem),
    totalCost: i.items?.reduce((sum, item) => sum + (Number(item.price_ksh) || 0), 0) ?? 0,
    currency: i.budget_currency ?? 'KES',
  }
}

interface TravelState {
  itineraries: Itinerary[]
  isLoading: boolean
  initialized: boolean
  lastFetched: number
  initialize: () => Promise<void>
  fetchItineraries: () => Promise<void>
  addItem: (itineraryId: number, input: CreateItineraryItemInput) => Promise<void>
  removeItem: (itineraryId: number, itemId: number) => Promise<void>
  bookItem: (itineraryId: number, itemId: number) => Promise<void>
}

const TRAVEL_STALE_MS = 30_000

export const useTravelStore = create<TravelState>((set, get) => ({
  itineraries: [],
  isLoading: false,
  initialized: false,
  lastFetched: 0,

  initialize: async () => {
    const { initialized, lastFetched } = get()
    if (initialized && Date.now() - lastFetched < TRAVEL_STALE_MS) return
    set({ isLoading: true })
    try {
      const data = await fetchItineraries()
      set({
        itineraries: data.map(mapItinerary),
        isLoading: false,
        initialized: true,
        lastFetched: Date.now(),
      })
    } catch {
      set({ isLoading: false, initialized: true, lastFetched: Date.now() })
    }
  },

  fetchItineraries: async () => {
    set({ isLoading: true })
    try {
      const data = await fetchItineraries()
      set({
        itineraries: data.map(mapItinerary),
        isLoading: false,
      })
    } catch {
      set({ isLoading: false })
    }
  },

  addItem: async (itineraryId, input) => {
    const created = await createItineraryItem(itineraryId, input)
    // Splice the new item into the matching itinerary so the day rail and
    // focus column reflect it immediately, without refetching the whole list.
    set((state) => ({
      itineraries: state.itineraries.map((it) =>
        it.id === itineraryId
          ? {
              ...it,
              items: [...it.items, mapItem(created)],
              totalCost: it.totalCost + (Number(created.price_ksh) || 0),
            }
          : it,
      ),
    }))
  },

  bookItem: async (itineraryId, itemId) => {
    const updated = await bookItineraryItem(itemId)
    const mapped = mapItem(updated)
    set((state) => ({
      itineraries: state.itineraries.map((it) =>
        it.id === itineraryId
          ? { ...it, items: it.items.map((i) => (i.id === itemId ? mapped : i)) }
          : it,
      ),
    }))
  },

  removeItem: async (itineraryId, itemId) => {
    await deleteItineraryItem(itemId)
    // Drop the item locally so the day rail + focus column update immediately.
    set((state) => ({
      itineraries: state.itineraries.map((it) =>
        it.id === itineraryId
          ? {
              ...it,
              items: it.items.filter((item) => item.id !== itemId),
              totalCost: it.items
                .filter((item) => item.id !== itemId)
                .reduce((sum, item) => sum + (item.cost || 0), 0),
            }
          : it,
      ),
    }))
  },
}))
