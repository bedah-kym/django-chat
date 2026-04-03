import { useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { mockCurrentUser } from '@/mocks/users'
import { useUiStore } from '@/stores/uiStore'
import styles from './SettingsPage.module.css'

type Tab = 'profile' | 'integrations' | 'preferences'

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const user = mockCurrentUser
  const theme = useUiStore(s => s.theme)
  const toggleTheme = useUiStore(s => s.toggleTheme)
  const [desktopNotifs, setDesktopNotifs] = useState(true)
  const [soundNotifs, setSoundNotifs] = useState(true)

  return (
    <div className={styles.settings}>
      <div className={styles.tabs}>
        {(['profile', 'integrations', 'preferences'] as Tab[]).map(tab => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === tab ? styles.activeTab : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <motion.div
          className={styles.tabContent}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className={styles.avatarSection}>
            <div className={styles.avatar}>{user.displayName.split(' ').map(n => n[0]).join('')}</div>
            <button className={styles.btnOutline}>Change Avatar</button>
          </div>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Display Name</span>
              <input className={styles.input} defaultValue={user.displayName} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Email</span>
              <input className={styles.input} defaultValue={user.email} type="email" />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Phone</span>
              <input className={styles.input} defaultValue={user.phone ?? ''} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Company</span>
              <input className={styles.input} defaultValue={user.company ?? ''} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Timezone</span>
              <input className={styles.input} defaultValue={user.timezone ?? ''} />
            </label>
          </div>
          <button className={styles.btnPrimary} onClick={() => toast.success('Profile saved')}>
            Save Changes
          </button>
        </motion.div>
      )}

      {activeTab === 'integrations' && (
        <motion.div
          className={styles.tabContent}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className={styles.integrationGrid}>
            {user.integrations.map(int => (
              <div key={int.type} className={styles.integrationCard}>
                <div className={styles.integrationHeader}>
                  <span className={styles.integrationName}>
                    {int.type.charAt(0).toUpperCase() + int.type.slice(1)}
                  </span>
                  <span className={`${styles.statusBadge} ${int.connected ? styles.connected : styles.disconnected}`}>
                    {int.connected ? 'Connected' : 'Not connected'}
                  </span>
                </div>
                {int.connected && int.accountName && (
                  <p className={styles.integrationAccount}>{int.accountName}</p>
                )}
                <button className={int.connected ? styles.btnDanger : styles.btnOutline}>
                  {int.connected ? 'Disconnect' : 'Connect'}
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {activeTab === 'preferences' && (
        <motion.div
          className={styles.tabContent}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className={styles.prefGroup}>
            <div className={styles.prefItem}>
              <div>
                <div className={styles.prefLabel}>Dark Mode</div>
                <div className={styles.prefDesc}>Switch between light and dark themes</div>
              </div>
              <button
                className={`${styles.toggle} ${theme === 'dark' ? styles.toggleOn : ''}`}
                onClick={() => {
                  toggleTheme()
                  toast.success(theme === 'dark' ? 'Switched to light mode' : 'Switched to dark mode')
                }}
                role="switch"
                aria-checked={theme === 'dark'}
              >
                <motion.div
                  className={styles.toggleThumb}
                  layout
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </button>
            </div>
            <div className={styles.prefItem}>
              <div>
                <div className={styles.prefLabel}>Desktop Notifications</div>
                <div className={styles.prefDesc}>Receive browser notifications for new messages</div>
              </div>
              <button
                className={`${styles.toggle} ${desktopNotifs ? styles.toggleOn : ''}`}
                onClick={() => setDesktopNotifs(!desktopNotifs)}
                role="switch"
                aria-checked={desktopNotifs}
              >
                <motion.div
                  className={styles.toggleThumb}
                  layout
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </button>
            </div>
            <div className={styles.prefItem}>
              <div>
                <div className={styles.prefLabel}>Sound Notifications</div>
                <div className={styles.prefDesc}>Play a sound for incoming messages</div>
              </div>
              <button
                className={`${styles.toggle} ${soundNotifs ? styles.toggleOn : ''}`}
                onClick={() => setSoundNotifs(!soundNotifs)}
                role="switch"
                aria-checked={soundNotifs}
              >
                <motion.div
                  className={styles.toggleThumb}
                  layout
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
