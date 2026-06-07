import { useState } from 'react'
import { motion } from 'framer-motion'
import { mockCurrentUser } from '@/mocks/users'
import { ProfileSection } from './sections/ProfileSection'
import { AssistantStyleSection } from './sections/AssistantStyleSection'
import { CapabilityControlsSection } from './sections/CapabilityControlsSection'
import { NotificationMatrixSection } from './sections/NotificationMatrixSection'
import { IntegrationsSection } from './sections/IntegrationsSection'
import { WorkspaceSection } from './sections/WorkspaceSection'
import { InvitesSection } from './sections/InvitesSection'
import styles from './SettingsPage.module.css'

type Tab = 'profile' | 'ai-controls' | 'preferences' | 'integrations' | 'workspace'

const TABS: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'ai-controls', label: 'AI Controls' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'workspace', label: 'Workspace' },
]

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const user = mockCurrentUser
  const showInvites = (user.inviteDepth ?? 1) === 0

  return (
    <div className={styles.settings}>
      <div className={styles.tabs}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.activeTab : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
      >
        {activeTab === 'profile' && (
          <>
            <ProfileSection user={user} />
            <div className={styles.sectionDivider} />
            <AssistantStyleSection />
          </>
        )}
        {activeTab === 'ai-controls' && <CapabilityControlsSection />}
        {activeTab === 'preferences' && <NotificationMatrixSection />}
        {activeTab === 'integrations' && <IntegrationsSection integrations={user.integrations} />}
        {activeTab === 'workspace' && (
          <>
            <WorkspaceSection />
            {showInvites && (
              <>
                <div className={styles.sectionDivider} />
                <InvitesSection />
              </>
            )}
          </>
        )}
      </motion.div>
    </div>
  )
}
