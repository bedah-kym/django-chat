import { Outlet, useLocation, NavLink } from 'react-router-dom'
import { Menu, Plus, Search } from 'lucide-react'
import { useEffect } from 'react'
import { domainConfigs, getDomainPageTitle, getRoomPath } from '@/domains'
import { useChatStore } from '@/stores/chatStore'
import { useUiStore } from '@/stores/uiStore'
import { PresenceDot } from '@/features/chat/components/PresenceDot'
import { MathiaAvatar } from '@/components/ui/MathiaAvatar'
import { DomainSwitcher } from './DomainSwitcher'
import styles from './DomainLayout.module.css'
import type { DomainId } from '@/types/domain'

interface Props {
  domainId: DomainId
}

export function DomainLayout({ domainId }: Props) {
  const location = useLocation()
  const lastDomain = useUiStore((s) => s.lastDomain)
  const setLastDomain = useUiStore((s) => s.setLastDomain)
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen)
  const rooms = useChatStore((s) => s.rooms)

  const domain = domainConfigs[domainId]
  const domainRooms = rooms.filter((room) => room.domain === domainId)
  const activeRoom = location.pathname.includes('/chat/')
    ? domainRooms.find((room) => location.pathname.endsWith(`/${room.id}`)) ?? null
    : null
  const pageTitle = getDomainPageTitle(domainId, location.pathname, activeRoom)

  useEffect(() => {
    if (lastDomain !== domainId) {
      setLastDomain(domainId)
    }
  }, [domainId, lastDomain, setLastDomain])

  return (
    <div className={styles.domainLayout}>
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <button className={styles.menuBtn} onClick={() => setSidebarOpen(true)}>
            <Menu size={18} />
          </button>
          <div>
            <div className={styles.eyebrow}>{domain.label} Workspace</div>
            <h1 className={styles.title}>{pageTitle}</h1>
            <p className={styles.description}>{domain.description}</p>
          </div>
        </div>
        <DomainSwitcher activeDomainId={domainId} />
      </div>

      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Workspace</div>
            <div className={styles.navList}>
              {domain.featureNav.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === domain.defaultRoute}
                    className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </NavLink>
                )
              })}
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.roomsHeader}>
              <span className={styles.sectionLabel}>Rooms</span>
              <button className={styles.addRoomBtn} title="New room">
                <Plus size={14} />
              </button>
            </div>
            <div className={styles.searchBox}>
              <Search size={14} className={styles.searchIcon} />
              <input className={styles.searchInput} placeholder={`Search ${domain.label.toLowerCase()} rooms`} />
            </div>
            <div className={styles.roomList}>
              {domainRooms.map((room) => {
                const onlineParticipant = room.participants.find((p) => p.isOnline && p.username !== 'mathia' && p.username !== 'alex')
                return (
                  <NavLink
                    key={room.id}
                    to={getRoomPath(room)}
                    className={({ isActive }) => `${styles.roomItem} ${isActive ? styles.roomActive : ''}`}
                  >
                    <div className={styles.roomAvatarWrap}>
                      <div className={`${styles.roomAvatar} ${room.isAiRoom ? styles.aiAvatar : ''}`}>
                        {room.isAiRoom ? <MathiaAvatar size={34} /> : room.displayName[0]}
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
                      <div className={styles.roomName}>{room.displayName}</div>
                      <div className={styles.roomPreview}>{room.lastMessage}</div>
                    </div>
                    {room.unreadCount > 0 && <span className={styles.badge}>{room.unreadCount}</span>}
                  </NavLink>
                )
              })}
              {domainRooms.length === 0 && (
                <div className={styles.emptyRooms}>No rooms in this domain yet.</div>
              )}
            </div>
          </div>
        </aside>

        <div className={location.pathname.includes('/chat/') ? styles.chatArea : styles.contentArea}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
