import { NavLink } from 'react-router-dom'
import { LayoutDashboard, MessageSquare, Plane, Wallet, Menu } from 'lucide-react'
import { useUiStore } from '@/stores/uiStore'
import styles from './MobileNav.module.css'

const items = [
  { path: '/app/dashboard', label: 'Home', icon: LayoutDashboard },
  { path: '/app/chat/1', label: 'Chat', icon: MessageSquare },
  { path: '/app/travel/itineraries', label: 'Travel', icon: Plane },
  { path: '/app/wallet', label: 'Wallet', icon: Wallet },
]

export function MobileNav() {
  const setSidebarOpen = useUiStore(s => s.setSidebarOpen)

  return (
    <nav className={styles.nav}>
      {items.map(item => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `${styles.item} ${isActive ? styles.active : ''}`
            }
          >
            <Icon size={22} strokeWidth={1.8} />
            <span className={styles.label}>{item.label}</span>
          </NavLink>
        )
      })}
      <button className={styles.item} onClick={() => setSidebarOpen(true)}>
        <Menu size={22} strokeWidth={1.8} />
        <span className={styles.label}>More</span>
      </button>
    </nav>
  )
}
