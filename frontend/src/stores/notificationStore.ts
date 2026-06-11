import { create } from 'zustand'
import type { Notification } from '@/types/notifications'
import { fetchNotifications, markAllRead as apiMarkAllRead, markRead as apiMarkRead } from '@/api/notifications'

function mapEventType(eventType: string): Notification['type'] {
  if (eventType === 'message.unread' || eventType === 'message.mention') return 'message'
  if (eventType.startsWith('payment.')) return 'payment'
  if (eventType === 'reminder.due') return 'reminder'
  if (eventType.startsWith('system.')) return 'system'
  if (eventType === 'message.unread' || eventType === 'message.mention') return 'message'
  return 'system'
}

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean
  page: number
  hasMore: boolean
  initialize: () => Promise<void>
  fetchNotifications: (page?: number) => Promise<void>
  markAllRead: () => Promise<void>
  markRead: (id: number) => Promise<void>
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  page: 1,
  hasMore: false,

  initialize: async () => {
    set({ isLoading: true })
    try {
      const data = await fetchNotifications(1)
      const mapped = data.notifications.map(n => ({
        id: n.id,
        type: mapEventType(n.event_type),
        title: n.title,
        body: n.body,
        isRead: n.is_read,
        createdAt: n.created_at,
      }))
      set({
        notifications: mapped,
        unreadCount: mapped.filter(n => !n.isRead).length,
        page: data.page,
        hasMore: data.has_more,
        isLoading: false,
      })
    } catch {
      set({ isLoading: false })
    }
  },

  fetchNotifications: async (page = 1) => {
    set({ isLoading: true })
    try {
      const data = await fetchNotifications(page)
      const mapped = data.notifications.map(n => ({
        id: n.id,
        type: mapEventType(n.event_type),
        title: n.title,
        body: n.body,
        isRead: n.is_read,
        createdAt: n.created_at,
      }))
      if (page === 1) {
        set({ notifications: mapped, page: data.page, hasMore: data.has_more })
      } else {
        set(s => ({
          notifications: [...s.notifications, ...mapped],
          page: data.page,
          hasMore: data.has_more,
        }))
      }
      set({ isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  markAllRead: async () => {
    try {
      await apiMarkAllRead()
      set(s => ({
        notifications: s.notifications.map(n => ({ ...n, isRead: true })),
        unreadCount: 0,
      }))
    } catch {
    }
  },

  markRead: async (id: number) => {
    try {
      await apiMarkRead(id)
      set(s => ({
        notifications: s.notifications.map(n =>
          n.id === id ? { ...n, isRead: true } : n
        ),
        unreadCount: Math.max(0, s.unreadCount - 1),
      }))
    } catch {
    }
  },
}))
