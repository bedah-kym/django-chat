import { Outlet, useLocation, NavLink } from 'react-router-dom'
import { Menu, Plus, Search, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { domainConfigs, getRoomPath } from '@/domains'
import { useChatStore } from '@/stores/chatStore'
import { useUiStore } from '@/stores/uiStore'
import { PresenceDot } from '@/features/chat/components/PresenceDot'
import { MathiaAvatar } from '@/components/ui/MathiaAvatar'
import { apiRequest } from '@/api/client'
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
  const domainRailCollapsed = useUiStore((s) => s.domainRailCollapsed)
  const toggleDomainRailCollapsed = useUiStore((s) => s.toggleDomainRailCollapsed)
  const rooms = useChatStore((s) => s.rooms)

  const [showCreate, setShowCreate] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [newRoomType, setNewRoomType] = useState<'general' | 'private'>('general')
  const [creating, setCreating] = useState(false)

  const domain = domainConfigs[domainId]
  const domainRooms = rooms.filter((room) => room.domain === domainId)

  useEffect(() => {
    if (lastDomain !== domainId) {
      setLastDomain(domainId)
    }
  }, [domainId, lastDomain, setLastDomain])

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return
    setCreating(true)
    try {
      const roomData = await apiRequest<{
        id: number
        name: string
        displayName: string
        lastMessage: string
        lastMessageTime: string | null
        unreadCount: number
        isAiRoom: boolean
        participants: { username: string; displayName: string; isOnline: boolean }[]
      }>('/rooms/create/', {
        method: 'POST',
        body: JSON.stringify({
          name: newRoomName.trim().toLowerCase().replace(/\s+/g, '-'),
          domain: domainId,
          room_type: newRoomType,
        }),
      })
      useChatStore.getState().addRoom({
        id: roomData.id,
        name: roomData.name,
        displayName: roomData.displayName,
        domain: domainId,
        lastMessage: roomData.lastMessage || '',
        lastMessageTime: roomData.lastMessageTime || '',
        unreadCount: roomData.unreadCount || 0,
        isAiRoom: roomData.isAiRoom ?? true,
        participants: roomData.participants || [],
      })
      setNewRoomName('')
      setNewRoomType('general')
      setShowCreate(false)
      toast.success(newRoomType === 'general' ? 'Room created with Mathia' : 'Private room created')
    } catch {
      toast.error('Failed to create room')
    } finally {
      setCreating(false)
    }
  }

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

      <div className={`${styles.body} ${!sidebarCollapsed ? styles.globalRailOpen : ''} ${domainRailCollapsed ? styles.railCollapsed : ''}`}>
        <aside className={styles.railMini}>
          <button
            className={styles.railToggleMini}
            onClick={toggleDomainRailCollapsed}
            title="Show rooms panel"
            aria-label="Show rooms panel"
          >
            <PanelLeftOpen size={16} />
          </button>
        </aside>
        <aside className={styles.sidebar}>
          <div className={styles.railHead}>
            <span className={styles.sectionLabel}>{domain.label}</span>
            <button
              className={styles.railToggle}
              onClick={toggleDomainRailCollapsed}
              title="Hide rooms panel"
              aria-label="Hide rooms panel"
            >
              <PanelLeftClose size={16} />
            </button>
          </div>
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
              <button className={styles.addRoomBtn} title="New room" onClick={() => setShowCreate(true)}>
                <Plus size={14} />
              </button>
            </div>

            {showCreate && (
              <div style={{
                padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--border-color)',
                borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['general', 'private'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setNewRoomType(t)}
                      title={t === 'general' ? 'Includes Mathia AI — replies automatically' : 'Solo or human-only — use @mathia to invoke AI'}
                      style={{
                        flex: 1, fontSize: 10, padding: '4px 8px', cursor: 'pointer',
                        background: newRoomType === t ? 'var(--primary-subtle)' : 'transparent',
                        color: newRoomType === t ? 'var(--primary-color)' : 'var(--text-muted)',
                        border: `1px solid ${newRoomType === t ? 'var(--primary-color)' : 'var(--border-color)'}`,
                        borderRadius: 5, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  autoFocus
                  value={newRoomName}
                  onChange={e => setNewRoomName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateRoom(); if (e.key === 'Escape') setShowCreate(false) }}
                  placeholder="Room name"
                  style={{
                    flex: 1, background: 'none', border: 'none', outline: 'none',
                    fontSize: 12, color: 'var(--text-color)',
                  }}
                />
                <button onClick={handleCreateRoom} disabled={creating || !newRoomName.trim()}
                  style={{
                    fontSize: 11, padding: '3px 8px', background: 'var(--primary-color)', color: '#fff',
                    border: 'none', borderRadius: 5, cursor: 'pointer', opacity: newRoomName.trim() ? 1 : 0.5,
                  }}>
                  {creating ? '...' : 'Create'}
                </button>
                <button onClick={() => setShowCreate(false)}
                  style={{
                    fontSize: 11, padding: '3px 6px', background: 'none', color: 'var(--text-muted)',
                    border: 'none', cursor: 'pointer',
                  }}>
                  ×
                </button>
                </div>
              </div>
            )}

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
