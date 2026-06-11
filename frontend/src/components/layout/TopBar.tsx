import { useLocation } from 'react-router-dom'
import * as Popover from '@radix-ui/react-popover'
import { Bell, Menu, Moon, Search, Sun } from 'lucide-react'
import { useNotificationStore } from '@/stores/notificationStore'
import { useUiStore } from '@/stores/uiStore'
import { useChatStore } from '@/stores/chatStore'
import { formatTime } from '@/utils/format'
import styles from './TopBar.module.css'

const pageTitles: Record<string, { title: string; description: string }> = {
  '/app/home': {
    title: 'Operations',
    description: 'Queue, workspaces, and active tasks.',
  },
  '/app/settings': {
    title: 'Settings',
    description: 'Profile, preferences, integrations, defaults.',
  },
  '/app/onboarding': {
    title: 'Welcome',
    description: 'Configure once — every workspace inherits.',
  },
}

export function TopBar() {
  const location = useLocation()
  const notifications = useNotificationStore((s) => s.notifications)
  const unreadNotifs = notifications.filter((n) => !n.isRead).length
  const chatUnread = useChatStore((s) => s.rooms.reduce((sum, room) => sum + room.unreadCount, 0))
  const unread = chatUnread || unreadNotifs
  const theme = useUiStore((s) => s.theme)
  const toggleTheme = useUiStore((s) => s.toggleTheme)
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen)
  const routeCopy = pageTitles[location.pathname] ?? pageTitles['/app/home']!

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <button className={styles.menuBtn} onClick={() => setSidebarOpen(true)} aria-label="Open navigation">
          <Menu size={20} />
        </button>
        <div>
          <h1 className={styles.title}>{routeCopy.title}</h1>
          <p className={styles.description}>{routeCopy.description}</p>
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.actionBtn} onClick={toggleTheme} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button className={styles.actionBtn} title="Search">
          <Search size={18} />
        </button>
        <Popover.Root>
          <Popover.Trigger asChild>
            <button className={styles.actionBtn} title="Notifications">
              <Bell size={18} />
              {unread > 0 ? <span className={styles.badge}>{unread}</span> : null}
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content className={styles.notifPanel} sideOffset={8} align="end">
              <div className={styles.notifHeader}>
                <span className={styles.notifTitle}>Notifications</span>
                {unread > 0 ? <button className={styles.markAllBtn}>Mark all read</button> : null}
              </div>
              <div className={styles.notifList}>
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`${styles.notifItem} ${!notification.isRead ? styles.unread : ''}`}
                  >
                    <div className={styles.notifMeta}>
                      <div className={styles.notifItemTitle}>{notification.title}</div>
                      <div className={styles.notifBody}>{notification.body}</div>
                    </div>
                    <div className={styles.notifTime}>{formatTime(notification.createdAt)}</div>
                  </div>
                ))}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </header>
  )
}
