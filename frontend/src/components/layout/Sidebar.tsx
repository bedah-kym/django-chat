import { NavLink, useLocation } from 'react-router-dom'
import * as Tooltip from '@radix-ui/react-tooltip'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { globalNavItems, getDomainFromPathname, domainConfigs } from '@/domains'
import { MiniSettings } from '@/features/chat/components/MiniSettings'
import { useUiStore } from '@/stores/uiStore'
import styles from './Sidebar.module.css'

interface Props {
  includeDomainContext?: boolean
  collapsible?: boolean
}

export function Sidebar({ includeDomainContext = false, collapsible = true }: Props) {
  const location = useLocation()
  const activeDomainId = getDomainFromPathname(location.pathname)
  const currentUser = useCurrentUser()
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggleSidebarCollapsed = useUiStore((s) => s.toggleSidebarCollapsed)
  const isCollapsed = collapsible ? collapsed : false

  return (
    <Tooltip.Provider delayDuration={150}>
      <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`} aria-label="Global navigation" data-tour="sidebar">
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
          {!isCollapsed ? <div className={styles.sectionLabel}>Platform</div> : null}
        </div>

        <nav className={styles.nav}>
          {globalNavItems.map((item) => {
            const Icon = item.icon
            const exact = !item.domain && item.path === '/app/home'
            const link = (
              <NavLink
                to={item.path}
                end={exact}
                className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
              >
                <span className={styles.iconWrap}>
                  <Icon size={17} strokeWidth={1.9} />
                </span>
                {!isCollapsed ? <span>{item.label}</span> : null}
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
        </nav>

        {includeDomainContext && activeDomainId && !isCollapsed ? (
          <div className={styles.contextCard}>
            <div className={styles.sectionLabel}>Current workspace</div>
            <div className={styles.contextTitle}>{domainConfigs[activeDomainId].label}</div>
            <p className={styles.contextBody}>{domainConfigs[activeDomainId].description}</p>
          </div>
        ) : null}

        <div className={styles.bottomSection}>
          {/* TODO: wire integrations from /api/integrations when endpoint exists */}
          <div className={styles.integrationRow} />
          {!isCollapsed ? <MiniSettings /> : null}
          {!isCollapsed ? <div className={styles.userDisplay}>{currentUser?.displayName || 'User'}</div> : null}
        </div>
      </aside>
    </Tooltip.Provider>
  )
}
