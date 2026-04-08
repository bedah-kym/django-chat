import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import * as Tooltip from '@radix-ui/react-tooltip'
import { Calendar, ChevronLeft, ChevronRight, CreditCard, Mail, Settings } from 'lucide-react'
import { mockCurrentUser } from '@/mocks/users'
import { globalNavItems, getDomainFromPathname, domainConfigs } from '@/domains'
import { DomainSwitcher } from './DomainSwitcher'
import { MiniSettings } from '@/features/chat/components/MiniSettings'
import { useUiStore } from '@/stores/uiStore'
import styles from './Sidebar.module.css'

const connectorIcons: Record<string, typeof Calendar> = {
  calendly: Calendar,
  gmail: Mail,
  intasend: CreditCard,
}

interface Props {
  includeDomainContext?: boolean
  collapsible?: boolean
}

export function Sidebar({ includeDomainContext = false, collapsible = true }: Props) {
  const location = useLocation()
  const activeDomainId = getDomainFromPathname(location.pathname)
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggleSidebarCollapsed = useUiStore((s) => s.toggleSidebarCollapsed)
  const isCollapsed = collapsible ? collapsed : false

  return (
    <Tooltip.Provider delayDuration={200}>
      <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`} data-tour="sidebar">
        <div className={styles.topSection}>
          <div className={styles.logoRow}>
            <motion.div className={styles.logoIcon} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              K
            </motion.div>
            {!isCollapsed && (
              <div className={styles.logoCopy}>
                <div className={styles.logoText}>Kazi</div>
                <div className={styles.logoSub}>Domain Workspaces</div>
              </div>
            )}
            {collapsible && (
              <button
                type="button"
                className={styles.collapseBtn}
                onClick={toggleSidebarCollapsed}
                aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
            )}
          </div>

          {!isCollapsed && <div className={styles.sectionEyebrow}>Global Navigation</div>}
        </div>

        <nav className={styles.nav}>
          {globalNavItems.map((item) => {
            const Icon = item.icon
            const exact = !item.domain && item.path === '/app/home'
            return (
              <Tooltip.Root key={item.path}>
                <Tooltip.Trigger asChild>
                  <NavLink
                    to={item.path}
                    end={exact}
                    className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                    {!isCollapsed && <span>{item.label}</span>}
                  </NavLink>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content className={styles.tooltip} side="right" sideOffset={8}>
                    {item.label}<Tooltip.Arrow className={styles.tooltipArrow} />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            )
          })}
        </nav>

        {includeDomainContext && activeDomainId && (
          <>
            <div className={styles.divider} />
            <div className={styles.domainContext}>
              {!isCollapsed && (
                <div className={styles.contextHeader}>
                  <span className={styles.contextLabel}>Current Domain</span>
                  <span className={styles.contextValue}>{domainConfigs[activeDomainId].label}</span>
                </div>
              )}
              <div className={styles.domainWrap}>
                <DomainSwitcher activeDomainId={activeDomainId} />
              </div>
            </div>
          </>
        )}

        <div className={styles.divider} />

        <div className={styles.bottomSection}>
          <div className={styles.connectors}>
            {mockCurrentUser.integrations.filter((integration) => integration.connected).map((integration) => {
              const Icon = connectorIcons[integration.type] ?? Settings
              return (
                <Tooltip.Root key={integration.type}>
                  <Tooltip.Trigger asChild>
                    <div className={styles.connectorDot}>
                      <Icon size={12} />
                    </div>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content className={styles.tooltip} side="top" sideOffset={6}>
                      {integration.type.charAt(0).toUpperCase() + integration.type.slice(1)} - {integration.accountName}
                      <Tooltip.Arrow className={styles.tooltipArrow} />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              )
            })}
          </div>
          {!isCollapsed && <MiniSettings />}
        </div>
      </aside>
    </Tooltip.Provider>
  )
}
