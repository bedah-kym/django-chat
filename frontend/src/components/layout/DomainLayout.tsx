import { Outlet, useLocation, NavLink } from 'react-router-dom'
import { Menu, Plus, Search } from 'lucide-react'
import { useEffect } from 'react'
import { domainConfigs, getRoomPath } from '@/domains'
import { useChatStore } from '@/stores/chatStore'
import { useUiStore } from '@/stores/uiStore'
import { PresenceDot } from '@/features/chat/components/PresenceDot'
import { MathiaAvatar } from '@/components/ui/MathiaAvatar'
import type { DomainId } from '@/types/domain'
import styles from './DomainLayout.module.css'

interface Props {
  domainId: DomainId
}

export function DomainLayout({ domainId }: Props) {
  const location = useLocation()
  const lastDomain = useUiStore((s) => s.lastDomain)
  const setLastDomain = useUiStore((s) => s.setLastDomain)
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen)
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed)
  const rooms = useChatStore((s) => s.rooms)

  const domain = domainConfigs[domainId]
  const domainRooms = rooms.filter((room) => room.domain === domainId)

  useEffect(() => {
    if (lastDomain !== domainId) {
      setLastDomain(domainId)
    }
  }, [domainId, lastDomain, setLastDomain])

  return (
    <div className={styles.domainLayout}>
      <div className={styles.mobileBar}>
        <button className={styles.menuBtn} onClick={() => setSidebarOpen(true)} aria-label="Open navigation">
          <Menu size={18} />
        </button>
        <div>
          <div className={styles.mobileLabel}>{domain.label}</div>
          <div className={styles.mobileDescription}>{domain.description}</div>
        </div>
      </div>

      <div className={`${styles.body} ${!sidebarCollapsed ? styles.globalRailOpen : ''}`}>
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
                const onlineParticipant = room.participants.find(
                  (participant) => participant.isOnline && participant.username !== 'mathia' && participant.username !== 'alex',
                )

                return (
                  <NavLink
                    key={room.id}
                    to={getRoomPath(room)}
                    className={({ isActive }) => `${styles.roomItem} ${isActive ? styles.roomActive : ''}`}
                  >
                    <div className={styles.roomAvatarWrap}>
                      <div className={`${styles.roomAvatar} ${room.isAiRoom ? styles.aiAvatar : ''}`}>
                        {room.isAiRoom ? <MathiaAvatar size={32} /> : room.displayName[0]}
                      </div>
                      <div className={styles.presencePos}>
                        <PresenceDot isOnline={!!onlineParticipant || room.isAiRoom} lastSeen={onlineParticipant?.lastSeen} size={7} />
                      </div>
                    </div>
                    <div className={styles.roomInfo}>
                      <div className={styles.roomName}>{room.displayName}</div>
                      <div className={styles.roomPreview}>{room.lastMessage}</div>
                    </div>
                    {room.unreadCount > 0 ? <span className={styles.badge}>{room.unreadCount}</span> : null}
                  </NavLink>
                )
              })}
            </div>
          </div>
        </aside>

        <section className={location.pathname.includes('/chat/') ? styles.chatArea : styles.contentArea}>
          <Outlet />
        </section>
      </div>
    </div>
  )
}
