import { NavLink, useLocation } from 'react-router-dom'
import * as Tooltip from '@radix-ui/react-tooltip'
import * as Popover from '@radix-ui/react-popover'
import { ChevronLeft, ChevronRight, Gauge } from 'lucide-react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { sidebarSections, personalNavItems } from '@/domains'
import { useUiStore } from '@/stores/uiStore'
import { useQuotaStore } from '@/stores/quotaStore'
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
  const quotas = useQuotaStore((s) => s.quotas)

  // Find the most critical quota category
  const criticalQuota = quotas
    ? (['messages', 'actions', 'search', 'uploads', 'tokens'] as const)
        .map((k) => quotas[k])
        .find((q) => q.status === 'exhausted' || q.status === 'critical')
        || (['messages', 'actions', 'search', 'uploads', 'tokens'] as const)
            .map((k) => quotas[k])
            .find((q) => q.status === 'warning')
    : null

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
                {criticalQuota ? (
                  <span
                    className={styles.quotaDot}
                    style={{
                      background:
                        criticalQuota.status === 'exhausted' ? '#ef4444' :
                        criticalQuota.status === 'critical' ? '#f97316' :
                        '#eab308',
                    }}
                  />
                ) : null}
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
                  <span className={styles.userMenuAvatar}>{userInitial}</span>
                  <div className={styles.userMenuIdentity}>
                    <span className={styles.userMenuName}>{currentUser?.displayName || 'User'}</span>
                    {currentUser?.email ? (
                      <span className={styles.userMenuEmail}>{currentUser.email}</span>
                    ) : null}
                  </div>
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
                          <span className={styles.userMenuItemIcon}>
                            <Icon size={17} strokeWidth={1.9} />
                          </span>
                          <span className={styles.userMenuItemLabel}>{item.label}</span>
                        </NavLink>
                      </Popover.Close>
                    )
                  })}
                </div>
                {quotas ? (
                  <NavLink
                    to="/app/settings?tab=quotas"
                    className={styles.quotaMenuFooter}
                  >
                    <Gauge size={14} />
                    <span className={styles.quotaMenuText}>
                      {criticalQuota
                        ? `${criticalQuota.name}: ${criticalQuota.used}/${criticalQuota.limit}`
                        : 'Quotas OK'}
                    </span>
                    <span
                      className={styles.quotaMenuBar}
                      style={{
                        background:
                          criticalQuota?.status === 'exhausted' ? '#ef4444' :
                          criticalQuota?.status === 'critical' ? '#f97316' :
                          criticalQuota?.status === 'warning' ? '#eab308' :
                          '#22c55e',
                        width: criticalQuota
                          ? `${Math.min(100, (criticalQuota.used / criticalQuota.limit) * 100)}%`
                          : '100%',
                      }}
                    />
                  </NavLink>
                ) : null}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      </aside>
    </Tooltip.Provider>
  )
}
