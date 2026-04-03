import { useLocation } from 'react-router-dom'
import * as Popover from '@radix-ui/react-popover'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Bell, MessageSquare, CreditCard, Clock, Mail, Info,
  Menu, Moon, Sun,
} from 'lucide-react'
import { mockNotifications } from '@/mocks/notifications'
import { useUiStore } from '@/stores/uiStore'
import { useChatStore } from '@/stores/chatStore'
import styles from './TopBar.module.css'

const pageTitles: Record<string, string> = {
  '/app/dashboard': 'Dashboard',
  '/app/settings': 'Settings',
  '/app/reminders': 'Reminders',
  '/app/travel/plan': 'Plan a Trip',
  '/app/travel/itineraries': 'My Trips',
  '/app/wallet': 'Wallet',
  '/app/invoices/new': 'Create Invoice',
  '/app/onboarding': 'Welcome to MATHIA',
}

const typeIcons = {
  message: MessageSquare,
  payment: CreditCard,
  reminder: Clock,
  invite: Mail,
  system: Info,
} as const

export function TopBar() {
  const location = useLocation()
  const chatUnread = useChatStore(s => s.rooms.reduce((sum, r) => sum + r.unreadCount, 0))
  const unread = chatUnread || mockNotifications.filter(n => !n.isRead).length
  const title = pageTitles[location.pathname] ?? ''
  const theme = useUiStore(s => s.theme)
  const toggleTheme = useUiStore(s => s.toggleTheme)
  const setSidebarOpen = useUiStore(s => s.setSidebarOpen)

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <button className={styles.menuBtn} onClick={() => setSidebarOpen(true)}>
          <Menu size={20} />
        </button>
        <h1 className={styles.title}>{title}</h1>
      </div>
      <div className={styles.actions}>
        <motion.button
          data-tour="theme-toggle"
          className={styles.actionBtn}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={theme}
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </motion.div>
          </AnimatePresence>
        </motion.button>

        <motion.button
          className={styles.actionBtn}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Search"
        >
          <Search size={18} />
        </motion.button>

        <Popover.Root>
          <Popover.Trigger asChild>
            <motion.button
              className={styles.actionBtn}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              data-tour="notifications"
              title="Notifications"
            >
              <Bell size={18} />
              {unread > 0 && (
                <motion.span
                  className={styles.badge}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                >
                  {unread}
                </motion.span>
              )}
            </motion.button>
          </Popover.Trigger>

          <AnimatePresence>
            <Popover.Portal>
              <Popover.Content sideOffset={8} align="end" asChild>
                <motion.div
                  className={styles.notifPanel}
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className={styles.notifHeader}>
                    <span className={styles.notifTitle}>Notifications</span>
                    {unread > 0 && (
                      <button className={styles.markAllBtn}>Mark all read</button>
                    )}
                  </div>
                  <div className={styles.notifList}>
                    {mockNotifications.map((n, i) => {
                      const Icon = typeIcons[n.type]
                      return (
                        <motion.div
                          key={n.id}
                          className={`${styles.notifItem} ${!n.isRead ? styles.unread : ''}`}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                        >
                          <div className={styles.notifIcon}>
                            <Icon size={16} />
                          </div>
                          <div className={styles.notifContent}>
                            <div className={styles.notifItemTitle}>{n.title}</div>
                            <div className={styles.notifBody}>{n.body}</div>
                            <div className={styles.notifTime}>
                              {new Date(n.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                  <Popover.Arrow className={styles.arrow} />
                </motion.div>
              </Popover.Content>
            </Popover.Portal>
          </AnimatePresence>
        </Popover.Root>
      </div>
    </header>
  )
}
