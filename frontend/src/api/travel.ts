import { getAuthToken } from './client'

export interface BookingReferenceResponse {
  id: number
  provider: string
  provider_booking_id: string
  booking_reference?: string | null
  confirmation_code?: string | null
  status: string
  booking_url?: string | null
  confirmation_email?: string | null
  metadata?: Record<string, unknown>
  booked_at?: string
  confirmed_at?: string | null
}

export interface ItineraryItemResponse {
  id: number
  item_type: string
  title: string
  description?: string | null
  start_datetime: string
  end_datetime?: string | null
  location_name?: string | null
  location_latitude?: number | null
  location_longitude?: number | null
  provider?: string | null
  provider_id?: string | null
  price_ksh?: string | null
  price_currency?: string
  booking_url?: string | null
  status: string
  metadata?: Record<string, unknown>
  booking?: BookingReferenceResponse | null
  booking_link?: { url: string; provider: string } | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ItineraryResponse {
  id: number
  user: number
  username: string
  title: string
  description?: string | null
  region: string
  start_date: string
  end_date: string
  duration_days: number
  budget_ksh?: string | null
  budget_currency?: string
  status: string
  is_public: boolean
  is_shared: boolean
  metadata?: Record<string, unknown>
  items: ItineraryItemResponse[]
  created_at: string
  updated_at: string
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken()
  return token ? { 'Authorization': `Token ${token}` } : {}
}

export async function fetchItineraries(): Promise<ItineraryResponse[]> {
  const res = await fetch('/travel/api/itinerary/', {
    headers: authHeaders(),
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`Travel API error: ${res.status}`)
  return res.json()
}

export async function fetchItinerary(id: number): Promise<ItineraryResponse> {
  const res = await fetch(`/travel/api/itinerary/${id}/`, {
    headers: authHeaders(),
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`Travel API error: ${res.status}`)
  return res.json()
}

export interface CreateItineraryInput {
  title: string
  region: string
  start_date: string
  end_date: string
  description?: string
  travellers?: number
  budget_ksh?: string
}

export async function createItinerary(input: CreateItineraryInput): Promise<ItineraryResponse> {
  const res = await fetch('/travel/api/itinerary/', {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`Travel API error: ${res.status}`)
  return res.json()
}

export interface CreateItineraryItemInput {
  item_type: 'flight' | 'hotel' | 'bus' | 'transfer' | 'event' | 'activity'
  title: string
  start_datetime: string
  end_datetime?: string
  location_name?: string
  price_ksh?: string
  price_currency?: string
  description?: string
  status?: string
}

export async function createItineraryItem(
  itineraryId: number,
  input: CreateItineraryItemInput,
): Promise<ItineraryItemResponse> {
  const res = await fetch(`/travel/api/itinerary/${itineraryId}/items/`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`Travel API error: ${res.status}`)
  return res.json()
}

export interface TripChatroomResponse {
  chatroom_id: number
  participants: {
    username: string
    displayName: string
    avatarUrl?: string
    isOnline: boolean
    lastSeen?: string | null
  }[]
}

export async function getTripChatroom(itineraryId: number): Promise<TripChatroomResponse> {
  const res = await fetch(`/travel/api/itinerary/${itineraryId}/chatroom/`, {
    headers: authHeaders(),
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`Travel API error: ${res.status}`)
  return res.json()
}

export async function bookItineraryItem(itemId: number): Promise<ItineraryItemResponse> {
  const res = await fetch(`/travel/api/items/${itemId}/book/`, {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`Travel API error: ${res.status}`)
  return res.json()
}

export async function deleteItineraryItem(itemId: number): Promise<void> {
  const res = await fetch(`/travel/delete-item/${itemId}/`, {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include',
  })
  if (!res.ok && res.status !== 204) throw new Error(`Travel API error: ${res.status}`)
}
