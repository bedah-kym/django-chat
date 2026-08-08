export interface Notification {
  id: number
  type: 'message' | 'invite' | 'system' | 'payment' | 'reminder'
  title: string
  body: string
  isRead: boolean
  createdAt: string
  roomId?: number
  actionUrl?: string
}

export interface NotificationCounts {
  total: number
  unread: number
}
