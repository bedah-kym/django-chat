import { NavLink, useLocation } from 'react-router-dom'
import * as Tooltip from '@radix-ui/react-tooltip'
import * as Popover from '@radix-ui/react-popover'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { sidebarSections, personalNavItems } from '@/domains'
import { useUiStore } from '@/stores/uiStore'
import styles from './Sidebar.module.css'

interface Props {
  collapsible?: boolean
}

export function Sidebar({ collapsible = true }: Props) {
  const location = useLocation()
  const currentUser = useCurrentUser()
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggleSidebarCollapsed = useUiStore((s) => s.toggleSidebarCollapsed)
  const isCollapsed = collapsible ? collapsed : false

  const userInitial = (currentUser?.displayName || 'U').trim().charAt(0).toUpperCase()
  const personalActive = personalNavItems.some((item) => location.pathname.startsWith(item.path))

  return (
    <Tooltip.Provider delayDuration={150}>
      <aside
        className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}
        aria-label="Global navigation"
        data-tour="sidebar"
      >
        {/* Brand + collapse */}
        <div className={styles.topSection}>
          <div className={styles.logoRow}>
            <div className={styles.logoMark}>M</div>
            {!isCollapsed ? (
              <div className={styles.logoCopy}>
                <div className={styles.logoText}>MATHIA</div>
                <div className={styles.logoSub}>os/1.0</div>
              </div>
            ) : null}
            {collapsible ? (
              <button
                type="button"
                className={styles.collapseBtn}
                onClick={toggleSidebarCollapsed}
                aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
            ) : null}
          </div>
        </div>

        {/* Sectioned navigation */}
        <nav className={styles.nav}>
          {sidebarSections.map((section) => (
            <div key={section.id} className={styles.section}>
              {section.label && !isCollapsed ? (
                <div className={styles.sectionLabel}>{section.label}</div>
              ) : null}
              {section.items.map((item) => {
                const Icon = item.icon
                const exact = !item.domain && item.path === '/app/home'
                const link = (
                  <NavLink
                    to={item.path}
                    end={exact}
                    className={({ isActive }) =>
                      `${styles.navItem} ${isActive ? styles.active : ''}`
                    }
                  >
                    <span className={styles.iconWrap}>
                      <Icon size={18} strokeWidth={1.9} />
                    </span>
                    {!isCollapsed ? <span className={styles.navLabel}>{item.label}</span> : null}
                  </NavLink>
                )

                return isCollapsed ? (
                  <Tooltip.Root key={item.path}>
                    <Tooltip.Trigger asChild>{link}</Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content className={styles.tooltip} side="right" sideOffset={8}>
                        {item.label}
                        <Tooltip.Arrow className={styles.tooltipArrow} />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                ) : (
                  <div key={item.path}>{link}</div>
                )
              })}
            </div>
          ))}
        </nav>

        {/* User menu (Personal items + future logout) */}
        <div className={styles.bottomSection}>
          <Popover.Root>
            <Popover.Trigger asChild>
              <button
                type="button"
                className={`${styles.userButton} ${personalActive ? styles.userActive : ''}`}
                aria-label="Open user menu"
              >
                <span className={styles.userAvatar}>{userInitial}</span>
                {!isCollapsed ? (
                  <span className={styles.userMeta}>
                    <span className={styles.userName}>{currentUser?.displayName || 'User'}</span>
                    <span className={styles.userHint}>Personal</span>
                  </span>
                ) : null}
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className={styles.userMenu}
                side={isCollapsed ? 'right' : 'top'}
                sideOffset={10}
                align="start"
              >
                <div className={styles.userMenuHeader}>
                  <span className={styles.userMenuName}>{currentUser?.displayName || 'User'}</span>
                  {currentUser?.email ? (
                    <span className={styles.userMenuEmail}>{currentUser.email}</span>
                  ) : null}
                </div>
                <div className={styles.userMenuList}>
                  {personalNavItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <Popover.Close asChild key={item.path}>
                        <NavLink
                          to={item.path}
                          className={({ isActive }) =>
                            `${styles.userMenuItem} ${isActive ? styles.userMenuItemActive : ''}`
                          }
                        >
                          <Icon size={15} strokeWidth={1.9} />
                          <span>{item.label}</span>
                        </NavLink>
                      </Popover.Close>
                    )
                  })}
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      </aside>
    </Tooltip.Provider>
  )
}
