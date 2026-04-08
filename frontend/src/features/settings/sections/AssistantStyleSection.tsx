import { useState } from 'react'
import { toast } from 'sonner'
import type { AssistantStyle } from '@/types/user'
import { updateProfile } from '../settingsApi'
import { SectionCard } from '../components/SectionCard'
import { SelectField } from '../components/SelectField'
import styles from '../SettingsPage.module.css'

const DEFAULT: AssistantStyle = {
  tone: 'friendly',
  verbosity: 'balanced',
  directness: 'neutral',
  locale: 'en-KE',
  dateOrder: 'DMY',
  timeFormat: '24h',
  currency: 'KES',
}

export function AssistantStyleSection() {
  const [style, setStyle] = useState<AssistantStyle>(DEFAULT)
  const [saving, setSaving] = useState(false)

  function set<K extends keyof AssistantStyle>(key: K, val: AssistantStyle[K]) {
    setStyle(prev => ({ ...prev, [key]: val }))
  }

  async function save() {
    setSaving(true)
    try {
      await updateProfile({ assistantStyle: style })
      toast.success('Assistant style saved')
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.tabContent}>
      <SectionCard title="Assistant Style">
        <div className={styles.formGrid}>
          <SelectField
            label="Tone"
            value={style.tone}
            onChange={v => set('tone', v as AssistantStyle['tone'])}
            options={[
              { value: 'friendly', label: 'Friendly' },
              { value: 'formal', label: 'Formal' },
              { value: 'direct', label: 'Direct' },
              { value: 'warm', label: 'Warm' },
              { value: 'casual', label: 'Casual' },
            ]}
          />
          <SelectField
            label="Verbosity"
            value={style.verbosity}
            onChange={v => set('verbosity', v as AssistantStyle['verbosity'])}
            options={[
              { value: 'short', label: 'Short & concise' },
              { value: 'balanced', label: 'Balanced' },
              { value: 'detailed', label: 'Detailed' },
            ]}
          />
          <SelectField
            label="Directness"
            value={style.directness}
            onChange={v => set('directness', v as AssistantStyle['directness'])}
            options={[
              { value: 'direct', label: 'Direct' },
              { value: 'neutral', label: 'Neutral' },
              { value: 'polite', label: 'Polite' },
            ]}
          />
        </div>
      </SectionCard>

      <SectionCard title="Locale & Formats">
        <div className={styles.formGrid}>
          <SelectField
            label="Locale"
            value={style.locale}
            onChange={v => set('locale', v)}
            options={[
              { value: 'en-KE', label: 'English (Kenya)' },
              { value: 'en-US', label: 'English (US)' },
              { value: 'en-GB', label: 'English (UK)' },
              { value: 'en-NG', label: 'English (Nigeria)' },
              { value: 'en-GH', label: 'English (Ghana)' },
              { value: 'sw-KE', label: 'Swahili (Kenya)' },
            ]}
          />
          <SelectField
            label="Date Format"
            value={style.dateOrder}
            onChange={v => set('dateOrder', v as AssistantStyle['dateOrder'])}
            options={[
              { value: 'DMY', label: 'DD/MM/YYYY' },
              { value: 'MDY', label: 'MM/DD/YYYY' },
              { value: 'YMD', label: 'YYYY-MM-DD' },
            ]}
          />
          <SelectField
            label="Time Format"
            value={style.timeFormat}
            onChange={v => set('timeFormat', v as AssistantStyle['timeFormat'])}
            options={[
              { value: '24h', label: '24-hour (14:00)' },
              { value: '12h', label: '12-hour (2:00 PM)' },
            ]}
          />
          <SelectField
            label="Currency"
            value={style.currency}
            onChange={v => set('currency', v)}
            options={[
              { value: 'KES', label: 'KES — Kenyan Shilling' },
              { value: 'USD', label: 'USD — US Dollar' },
              { value: 'EUR', label: 'EUR — Euro' },
              { value: 'GBP', label: 'GBP — British Pound' },
              { value: 'NGN', label: 'NGN — Nigerian Naira' },
              { value: 'GHS', label: 'GHS — Ghanaian Cedi' },
              { value: 'ZAR', label: 'ZAR — South African Rand' },
            ]}
          />
        </div>
      </SectionCard>

      <button className={styles.btnPrimary} onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save Style'}
      </button>
    </div>
  )
}
