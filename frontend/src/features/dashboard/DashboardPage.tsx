import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  MessageSquare, MessagesSquare, Wallet, Plane, Plus,
  CreditCard, Clock, Mail, Info,
} from 'lucide-react'
import { useChatStore } from '@/stores/chatStore'
import { usePaymentStore } from '@/stores/paymentStore'
import { useTravelStore } from '@/stores/travelStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { getRoomPath } from '@/domains'
import styles from './DashboardPage.module.css'

const typeIcons = {
  message: MessageSquare,
  payment: CreditCard,
  reminder: Clock,
  invite: Mail,
  system: Info,
} as const

export function DashboardPage() {
  const mockRooms = useChatStore(s => s.rooms)
  const totalUnread = useChatStore(s => s.rooms.reduce((sum, r) => sum + r.unreadCount, 0))
  const wallet = usePaymentStore(s => s.wallet)
  const itineraries = useTravelStore(s => s.itineraries)
  const notifications = useNotificationStore(s => s.notifications)

  const stats = [
    { label: 'Active Rooms', value: mockRooms.length, icon: MessagesSquare },
    { label: 'Unread Messages', value: totalUnread, icon: MessageSquare },
    { label: 'Wallet Balance', value: `KES ${(wallet?.balance ?? 0).toLocaleString()}`, icon: Wallet },
    { label: 'Upcoming Trips', value: itineraries?.length ?? 0, icon: Plane },
  ]

  return (
    <div className={styles.dashboard}>
      {/* Stats */}
      <div className={styles.statsRow}>
        {stats.map((stat, i) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={stat.label}
              className={styles.statCard}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
            >
              <div className={styles.statIcon}>
                <Icon size={20} />
              </div>
              <div className={styles.statValue}>{stat.value}</div>
              <div className={styles.statLabel}>{stat.label}</div>
            </motion.div>
          )
        })}
      </div>

      {/* Rooms */}
      <div className={styles.sectionHeader}>
        <h2>Your Rooms</h2>
        <motion.button className={styles.createBtn} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Plus size={15} /> New Room
        </motion.button>
      </div>
      <div className={styles.roomsGrid}>
        {mockRooms.map((room, i) => (
          <motion.div
            key={room.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.05, duration: 0.3 }}
          >
            <Link to={getRoomPath(room)} className={styles.roomCard}>
              <div className={styles.roomCardHeader}>
                <div className={styles.roomAvatar}>
                  {room.isAiRoom ? '✦' : room.displayName[0]}
                </div>
                <div>
                  <div className={styles.roomCardName}>{room.displayName}</div>
                  <div className={styles.roomCardMeta}>{room.participants.length} members</div>
                </div>
                {room.unreadCount > 0 && <span className={styles.badge}>{room.unreadCount}</span>}
              </div>
              <p className={styles.roomCardPreview}>{room.lastMessage}</p>
              <span className={styles.roomCardTime}>{new Date(room.lastMessageTime).toLocaleString()}</span>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Activity */}
      <div className={styles.sectionHeader}>
        <h2>Recent Activity</h2>
      </div>
      <div className={styles.activityList}>
        {(notifications ?? []).slice(0, 4).map((n, i) => {
          const Icon = typeIcons[n.type]
          return (
            <motion.div
              key={n.id}
              className={`${styles.activityItem} ${!n.isRead ? styles.unread : ''}`}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.05 }}
            >
              <div className={styles.activityIcon}>
                <Icon size={16} />
              </div>
              <div className={styles.activityContent}>
                <div className={styles.activityTitle}>{n.title}</div>
                <div className={styles.activityBody}>{n.body}</div>
              </div>
              <div className={styles.activityTime}>
                {new Date(n.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
