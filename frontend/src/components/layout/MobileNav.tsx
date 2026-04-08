import { NavLink, useLocation } from 'react-router-dom'
import { Home, Menu, MessageSquare } from 'lucide-react'
import { useUiStore } from '@/stores/uiStore'
import { useChatStore } from '@/stores/chatStore'
import { domainConfigs, getDomainFromPathname, getRoomPath } from '@/domains'
import styles from './MobileNav.module.css'

export function MobileNav() {
  const location = useLocation()
  const activeDomainId = getDomainFromPathname(location.pathname)
  const lastDomain = useUiStore((s) => s.lastDomain)
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen)
  const rooms = useChatStore((s) => s.rooms)

  const currentDomainId = activeDomainId ?? lastDomain
  const currentDomain = domainConfigs[currentDomainId]
  const roomTarget = rooms.find((room) => room.domain === currentDomainId)
  const roomsPath = roomTarget ? getRoomPath(roomTarget) : currentDomain.defaultRoute
  const DomainIcon = currentDomain.icon

  const items = [
    { path: '/app/home', label: 'Home', icon: Home, end: true },
    { path: currentDomain.defaultRoute, label: currentDomain.label, icon: DomainIcon, end: true },
    { path: roomsPath, label: 'Rooms', icon: MessageSquare, end: false },
  ]

  return (
    <nav className={styles.nav}>
      {items.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.label}
            to={item.path}
            end={item.end}
            className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ''}`}
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
