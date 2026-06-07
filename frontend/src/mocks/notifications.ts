import type { Notification } from '@/types/notifications'

export const mockNotifications: Notification[] = [
  { id: 1, type: 'message', title: 'New message in TechVentures Strategy', body: 'Mathia: I\'ve drafted the Q2 roadmap.', isRead: false, createdAt: '2026-04-03T10:30:00Z', roomId: 1 },
  { id: 2, type: 'payment', title: 'Invoice paid', body: 'Invoice #INV-2026-038 has been paid — KES 75,000', isRead: false, createdAt: '2026-04-03T09:00:00Z' },
  { id: 3, type: 'reminder', title: 'Team standup in 15 minutes', body: '10:00 AM — Daily standup meeting', isRead: false, createdAt: '2026-04-03T09:45:00Z' },
  { id: 4, type: 'invite', title: 'Room invite', body: 'Sarah invited you to "Product Launch" room', isRead: true, createdAt: '2026-04-02T16:00:00Z', roomId: 6 },
  { id: 5, type: 'system', title: 'Travel booking confirmed', body: 'Sarova Stanley — April 15-18, Nairobi', isRead: true, createdAt: '2026-04-02T14:00:00Z' },
]
