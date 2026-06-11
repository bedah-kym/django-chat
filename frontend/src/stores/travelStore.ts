import { create } from 'zustand'
import type { Itinerary, ItineraryItem } from '@/types/travel'
import { fetchItineraries } from '@/api/travel'
import type { ItineraryResponse } from '@/api/travel'

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
  return {
    id: item.id,
    type: item.item_type as ItineraryItem['type'],
    name: item.title,
    date,
    time,
    location: item.location_name ?? '',
    cost: item.price_ksh ? Number(item.price_ksh) : 0,
    currency: item.price_currency ?? 'KES',
    status: item.status as ItineraryItem['status'],
    details: item.description ?? undefined,
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
  initialize: () => Promise<void>
  fetchItineraries: () => Promise<void>
}

export const useTravelStore = create<TravelState>((set) => ({
  itineraries: [],
  isLoading: false,

  initialize: async () => {
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
}))
