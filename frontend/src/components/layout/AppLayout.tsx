import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { MobileNav } from './MobileNav'
import { MobileDrawer } from './MobileDrawer'
import { AppShell } from '@/components/ui/AppShell'
import { useUiStore } from '@/stores/uiStore'
import { getDomainFromPathname } from '@/domains'
import styles from './AppLayout.module.css'

export function AppLayout() {
  const location = useLocation()
  const activeDomainId = getDomainFromPathname(location.pathname)
  const isDomainRoute = !!activeDomainId
  const isChat = location.pathname.includes('/chat/')
  const sidebarOpen = useUiStore((s) => s.sidebarOpen)
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen)

  return (
    <AppShell
      sidebar={
        <div className={styles.desktopSidebar}>
          <Sidebar />
        </div>
      }
      drawer={
        <MobileDrawer open={sidebarOpen} onClose={() => setSidebarOpen(false)}>
          <Sidebar collapsible={false} />
        </MobileDrawer>
      }
      header={!isDomainRoute && !isChat ? <TopBar /> : undefined}
      footer={!isChat ? <MobileNav /> : undefined}
      contentClassName={styles.mainColumn}
    >
      <div className={isChat ? styles.chatContent : isDomainRoute ? styles.domainContent : styles.content}>
        <div key={location.pathname} className={styles.pageMotion}>
          <Outlet />
        </div>
      </div>
    </AppShell>
  )
}
