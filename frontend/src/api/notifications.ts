import { getAuthToken } from './client'

interface NotificationResponse {
  id: number
  event_type: string
  severity: string
  title: string
  body: string
  is_read: boolean
  created_at: string
  metadata?: Record<string, unknown>
}

export interface PaginatedNotifications {
  notifications: NotificationResponse[]
  page: number
  has_more: boolean
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken()
  return token ? { 'Authorization': `Token ${token}` } : {}
}

export async function fetchNotifications(page = 1): Promise<PaginatedNotifications> {
  const res = await fetch(`/notifications/api/?page=${page}`, {
    headers: authHeaders(),
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`Notifications API error: ${res.status}`)
  return res.json()
}

export async function markAllRead(): Promise<void> {
  const res = await fetch('/notifications/api/read-all/', {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`Mark all read error: ${res.status}`)
}

export async function markRead(id: number): Promise<void> {
  const res = await fetch(`/notifications/api/${id}/read/`, {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`Mark read error: ${res.status}`)
}
