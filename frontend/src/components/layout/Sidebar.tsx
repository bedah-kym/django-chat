import { NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import * as Tooltip from '@radix-ui/react-tooltip'
import {
  LayoutDashboard, Plane, Wallet, Clock, Settings,
  Plus, Search, Sparkles,
} from 'lucide-react'
import { useChatStore } from '@/stores/chatStore'
import { PresenceDot } from '@/features/chat/components/PresenceDot'
import { MiniSettings } from '@/features/chat/components/MiniSettings'
import styles from './Sidebar.module.css'

const navItems = [
  { path: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/app/travel/itineraries', label: 'Travel', icon: Plane },
  { path: '/app/wallet', label: 'Wallet', icon: Wallet },
  { path: '/app/reminders', label: 'Reminders', icon: Clock },
  { path: '/app/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const rooms = useChatStore(s => s.rooms)
  const totalUnread = useChatStore(s => s.rooms.reduce((sum, r) => sum + r.unreadCount, 0))

  return (
    <aside className={styles.sidebar} data-tour="sidebar">
      <div className={styles.logo}>
        <motion.div className={styles.logoIcon} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          M
        </motion.div>
      </div>

      <Tooltip.Provider delayDuration={200}>
        <nav className={styles.nav}>
          {navItems.map(item => {
            const Icon = item.icon
            return (
              <Tooltip.Root key={item.path}>
                <Tooltip.Trigger asChild>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                  </NavLink>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content className={styles.tooltip} side="right" sideOffset={8}>
                    {item.label}<Tooltip.Arrow className={styles.tooltipArrow} />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            )
          })}
        </nav>
      </Tooltip.Provider>

      <div className={styles.divider} />

      <div className={styles.roomsHeader}>
        <span className={styles.roomsTitle}>Rooms</span>
        <div className={styles.roomsActions}>
          {totalUnread > 0 && (
            <motion.span className={styles.badge} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
              {totalUnread}
            </motion.span>
          )}
          <motion.button className={styles.addRoomBtn} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} title="New room">
            <Plus size={15} />
          </motion.button>
        </div>
      </div>

      <div className={styles.searchBox}>
        <Search size={14} className={styles.searchIcon} />
        <input className={styles.searchInput} placeholder="Search rooms..." />
      </div>

      <div className={styles.roomList} data-tour="room-list">
        <AnimatePresence>
          {rooms.map((room, i) => {
            const onlineParticipant = room.participants.find(p => p.isOnline && p.username !== 'mathia' && p.username !== 'alex')
            return (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, duration: 0.25 }}
              >
                <NavLink
                  to={`/app/chat/${room.id}`}
                  className={({ isActive }) => `${styles.roomItem} ${isActive ? styles.activeRoom : ''}`}
                >
                  <div className={styles.roomAvatarWrapper}>
                    <div className={`${styles.roomAvatar} ${room.isAiRoom ? styles.aiAvatar : ''}`}>
                      {room.isAiRoom ? <Sparkles size={16} /> : room.displayName[0]}
                    </div>
                    <div className={styles.presencePos}>
                      <PresenceDot
                        isOnline={!!onlineParticipant || room.isAiRoom}
                        lastSeen={onlineParticipant?.lastSeen}
                        size={7}
                      />
                    </div>
                  </div>
                  <div className={styles.roomInfo}>
                    <div className={`${styles.roomName} ${room.unreadCount > 0 ? styles.unreadName : ''}`}>
                      {room.displayName}
                    </div>
                    <div className={styles.roomPreview}>{room.lastMessage}</div>
                  </div>
                  {room.unreadCount > 0 && (
                    <span className={styles.badge}>{room.unreadCount}</span>
                  )}
                </NavLink>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      <div className={styles.userSection}>
        <div className={styles.userAvatar}>AM</div>
        <div className={styles.userInfo}>
          <div className={styles.userName}>Alex Mwangi</div>
          <div className={styles.userStatus}>
            <span className={styles.onlineDotSmall} />
            Online
          </div>
        </div>
        <MiniSettings />
      </div>
    </aside>
  )
}
