import { useState } from 'react'
import { toast } from 'sonner'
import type { NotificationMatrix, NotificationEventKey, NotificationChannel } from '@/types/user'
import { updateNotificationPrefs } from '../settingsApi'
import { SectionCard } from '../components/SectionCard'
import { ToggleRow } from '../components/ToggleRow'
import { NotificationRow } from '../components/NotificationRow'
import { useUiStore } from '@/stores/uiStore'
import { useSettingsStore } from '@/stores/settingsStore'
import styles from '../SettingsPage.module.css'

const EVENT_LABELS: Record<NotificationEventKey, string> = {
  'payment.deposit': 'Payment received',
  'payment.withdrawal': 'Payment sent',
  'payment.invoice': 'Invoice activity',
  'payment.error': 'Payment error',
  'reminder.due': 'Reminder due',
  'message.unread': 'Unread message',
  'message.mention': 'Mention',
  'system.info': 'System info',
  'system.warning': 'System warning',
}

const DEFAULT_MATRIX: NotificationMatrix = {
  'payment.deposit': { inApp: true, email: true, whatsapp: false },
  'payment.withdrawal': { inApp: true, email: true, whatsapp: false },
  'payment.invoice': { inApp: true, email: true, whatsapp: false },
  'payment.error': { inApp: true, email: true, whatsapp: true },
  'reminder.due': { inApp: true, email: false, whatsapp: false },
  'message.unread': { inApp: true, email: false, whatsapp: false },
  'message.mention': { inApp: true, email: false, whatsapp: false },
  'system.info': { inApp: true, email: false, whatsapp: false },
  'system.warning': { inApp: true, email: true, whatsapp: false },
}

export function NotificationMatrixSection() {
  const theme = useUiStore(s => s.theme)
  const toggleTheme = useUiStore(s => s.toggleTheme)
  const soundEnabled = useSettingsStore(s => s.soundEnabled)
  const toggleSound = useSettingsStore(s => s.toggleSound)

  const [desktopNotifs, setDesktopNotifs] = useState(true)
  const [aiPersonalization, setAiPersonalization] = useState(true)
  const [matrix, setMatrix] = useState<NotificationMatrix>(DEFAULT_MATRIX)
  const [saving, setSaving] = useState(false)

  function updateRow(key: NotificationEventKey, val: NotificationChannel) {
    setMatrix(prev => ({ ...prev, [key]: val }))
  }

  async function save() {
    setSaving(true)
    try {
      await updateNotificationPrefs({ matrix, aiPersonalization })
      toast.success('Notification preferences saved')
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.tabContent}>
      {/* Display */}
      <SectionCard title="Display">
        <ToggleRow
          label="Dark Mode"
          description="Switch between light and dark themes"
          checked={theme === 'dark'}
          onChange={() => toggleTheme()}
        />
        <ToggleRow
          label="Desktop Notifications"
          description="Receive browser notifications for new messages"
          checked={desktopNotifs}
          onChange={setDesktopNotifs}
        />
        <ToggleRow
          label="Sound Notifications"
          description="Play a sound for incoming messages"
          checked={soundEnabled}
          onChange={() => toggleSound()}
        />
      </SectionCard>

      {/* AI Personalization */}
      <SectionCard title="AI Personalization">
        <ToggleRow
          label="Enable AI Personalization"
          description="Kazi uses your profile to personalise suggestions and responses"
          checked={aiPersonalization}
          onChange={setAiPersonalization}
        />
      </SectionCard>

      {/* Notification Matrix */}
      <SectionCard title="Notification Channels">
        {(Object.keys(DEFAULT_MATRIX) as NotificationEventKey[]).map(key => (
          <NotificationRow
            key={key}
            label={EVENT_LABELS[key]}
            value={matrix[key]}
            onChange={val => updateRow(key, val)}
          />
        ))}
      </SectionCard>

      <button className={styles.btnPrimary} onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save Preferences'}
      </button>
    </div>
  )
}
