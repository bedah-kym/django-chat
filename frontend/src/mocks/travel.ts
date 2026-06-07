import type { Itinerary } from '@/types/travel'

export const mockItineraries: Itinerary[] = [
  {
    id: 1,
    name: 'Nairobi Conference Trip',
    destination: 'Nairobi, Kenya',
    startDate: '2026-04-15',
    endDate: '2026-04-18',
    status: 'confirmed',
    totalCost: 45400,
    currency: 'KES',
    items: [
      { id: 1, type: 'flight', name: 'Fly540 — Mombasa to Nairobi', date: '2026-04-15', time: '08:00', location: 'Moi International Airport', cost: 8500, currency: 'KES', status: 'booked' },
      { id: 2, type: 'hotel', name: 'Sarova Stanley — 3 nights', date: '2026-04-15', time: '14:00', location: 'Kenyatta Avenue, Nairobi', cost: 32400, currency: 'KES', status: 'booked' },
      { id: 3, type: 'transfer', name: 'Airport shuttle', date: '2026-04-15', time: '10:30', location: 'JKIA → Sarova Stanley', cost: 2500, currency: 'KES', status: 'booked' },
      { id: 4, type: 'event', name: 'Tech Conference 2026', date: '2026-04-16', time: '09:00', location: 'KICC, Nairobi', cost: 2000, currency: 'KES', status: 'booked' },
    ],
  },
  {
    id: 2,
    name: 'Diani Beach Retreat',
    destination: 'Diani, Kenya',
    startDate: '2026-05-10',
    endDate: '2026-05-13',
    status: 'planning',
    totalCost: 0,
    currency: 'KES',
    items: [],
  },
]
