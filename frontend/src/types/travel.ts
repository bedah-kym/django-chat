export interface Itinerary {
  id: number
  name: string
  destination: string
  startDate: string
  endDate: string
  status: 'planning' | 'confirmed' | 'completed' | 'archived'
  items: ItineraryItem[]
  totalCost: number
  currency: string
}

export interface ItineraryItem {
  id: number
  type: 'flight' | 'hotel' | 'bus' | 'transfer' | 'event' | 'activity'
  name: string
  date: string
  time?: string
  location: string
  cost: number
  currency: string
  status: 'booked' | 'pending' | 'cancelled'
  details?: string
}

export interface SearchResult {
  id: string
  type: 'flight' | 'hotel' | 'bus' | 'transfer' | 'event'
  name: string
  price: number
  currency: string
  rating?: number
  description: string
  imageUrl?: string
}
