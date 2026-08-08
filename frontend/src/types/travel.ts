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

export interface ItemBooking {
  provider: string
  providerBookingId: string
  bookingReference?: string | null
  confirmationCode?: string | null
  status: string
  bookingUrl?: string | null
  confirmationEmail?: string | null
  bookedAt?: string
  confirmedAt?: string | null
}

export interface ItineraryItem {
  id: number
  type: 'flight' | 'hotel' | 'bus' | 'transfer' | 'event' | 'activity'
  name: string
  date: string
  time?: string
  endTime?: string
  location: string
  cost: number
  currency: string
  status: 'booked' | 'pending' | 'cancelled' | 'planned' | 'completed'
  details?: string
  provider?: string
  bookingUrl?: string
  booking?: ItemBooking | null
  bookingLink?: { url: string; provider: string }
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
