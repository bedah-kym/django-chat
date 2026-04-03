import { Outlet, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { MobileNav } from './MobileNav'
import { MobileDrawer } from './MobileDrawer'
import { useUiStore } from '@/stores/uiStore'
import styles from './AppLayout.module.css'

export function AppLayout() {
  const location = useLocation()
  const isChat = location.pathname.startsWith('/app/chat')
  const sidebarOpen = useUiStore(s => s.sidebarOpen)
  const setSidebarOpen = useUiStore(s => s.setSidebarOpen)

  return (
    <div className={styles.layout}>
      {/* Desktop sidebar */}
      <div className={styles.desktopSidebar}>
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      <MobileDrawer open={sidebarOpen} onClose={() => setSidebarOpen(false)}>
        <Sidebar />
      </MobileDrawer>

      <div className={styles.main}>
        {!isChat && <TopBar />}
        <div className={isChat ? styles.chatContent : styles.content}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              style={{ height: '100%' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Mobile bottom nav — hidden in chat */}
        {!isChat && <MobileNav />}
      </div>
    </div>
  )
}
