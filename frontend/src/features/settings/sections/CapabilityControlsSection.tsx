import { useState } from 'react'
import { toast } from 'sonner'
import type { CapabilitySettings, CapabilityMode } from '@/types/user'
import { updateCapabilities } from '../settingsApi'
import { SectionCard } from '../components/SectionCard'
import { ToggleRow } from '../components/ToggleRow'
import { SelectField } from '../components/SelectField'
import styles from '../SettingsPage.module.css'

const PRESETS: Record<Exclude<CapabilityMode, 'custom'>, Partial<CapabilitySettings>> = {
  conserve: {
    proactiveAssistant: false,
    aiVoice: false,
    managerLlm: false,
    nudgeFrequency: 'low',
    allowWebSearch: false,
    allowTravel: false,
    allowPayments: false,
    allowReminders: true,
    allowEmail: false,
    allowWhatsapp: false,
    allowCalendar: false,
  },
  balanced: {
    proactiveAssistant: true,
    aiVoice: false,
    managerLlm: true,
    nudgeFrequency: 'medium',
    allowWebSearch: true,
    allowTravel: false,
    allowPayments: true,
    allowReminders: true,
    allowEmail: true,
    allowWhatsapp: false,
    allowCalendar: true,
  },
  max: {
    proactiveAssistant: true,
    aiVoice: true,
    managerLlm: true,
    nudgeFrequency: 'high',
    allowWebSearch: true,
    allowTravel: true,
    allowPayments: true,
    allowReminders: true,
    allowEmail: true,
    allowWhatsapp: true,
    allowCalendar: true,
  },
}

const DEFAULT: CapabilitySettings = {
  mode: 'balanced',
  ...PRESETS.balanced,
  snoozeUntil: 'none',
} as CapabilitySettings

const MODES: { value: CapabilityMode; label: string; desc: string }[] = [
  { value: 'conserve', label: 'Conserve', desc: 'Minimal — only essential tools' },
  { value: 'balanced', label: 'Balanced', desc: 'Smart defaults, most tools on' },
  { value: 'max', label: 'Max', desc: 'All features and tools enabled' },
  { value: 'custom', label: 'Custom', desc: 'You control every setting' },
]

export function CapabilityControlsSection() {
  const [caps, setCaps] = useState<CapabilitySettings>(DEFAULT)
  const [saving, setSaving] = useState(false)

  function applyMode(mode: CapabilityMode) {
    if (mode === 'custom') {
      setCaps(prev => ({ ...prev, mode }))
    } else {
      setCaps(prev => ({ ...prev, mode, ...PRESETS[mode] }))
    }
  }

  function toggle(key: keyof CapabilitySettings) {
    setCaps(prev => ({ ...prev, [key]: !prev[key], mode: 'custom' }))
  }

  function set<K extends keyof CapabilitySettings>(key: K, val: CapabilitySettings[K]) {
    setCaps(prev => ({ ...prev, [key]: val, mode: 'custom' }))
  }

  async function save() {
    setSaving(true)
    try {
      await updateCapabilities(caps)
      toast.success('AI controls saved')
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.tabContent}>
      {/* Mode Presets */}
      <SectionCard title="Mode">
        <div className={styles.modeGrid}>
          {MODES.map(m => (
            <button
              key={m.value}
              type="button"
              className={`${styles.modeCard} ${caps.mode === m.value ? styles.modeCardActive : ''}`}
              onClick={() => applyMode(m.value)}
            >
              <span className={styles.modeLabel}>{m.label}</span>
              <span className={styles.modeDesc}>{m.desc}</span>
            </button>
          ))}
        </div>
      </SectionCard>

      {/* Assistant Behavior */}
      <SectionCard title="Assistant Behavior">
        <ToggleRow
          label="Proactive suggestions"
          description="Kazi will proactively suggest actions and next steps"
          checked={caps.proactiveAssistant}
          onChange={() => toggle('proactiveAssistant')}
        />
        <ToggleRow
          label="AI voice replies"
          description="Enable voice responses from the assistant"
          checked={caps.aiVoice}
          onChange={() => toggle('aiVoice')}
        />
        <ToggleRow
          label="Manager LLM fallback"
          description="Use a more capable model for complex tasks"
          checked={caps.managerLlm}
          onChange={() => toggle('managerLlm')}
        />
        <div className={styles.selectRow}>
          <SelectField
            label="Nudge frequency"
            value={caps.nudgeFrequency}
            onChange={v => set('nudgeFrequency', v as CapabilitySettings['nudgeFrequency'])}
            options={[
              { value: 'off', label: 'Off' },
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
            ]}
          />
          <SelectField
            label="Snooze nudges"
            value={caps.snoozeUntil}
            onChange={v => set('snoozeUntil', v as CapabilitySettings['snoozeUntil'])}
            options={[
              { value: 'none', label: 'Not snoozed' },
              { value: '1h', label: 'For 1 hour' },
              { value: '8h', label: 'For 8 hours' },
              { value: '24h', label: 'For 24 hours' },
              { value: '3d', label: 'For 3 days' },
            ]}
          />
        </div>
      </SectionCard>

      {/* Tool Access */}
      <SectionCard title="Tool Access">
        <ToggleRow label="Web search & research" checked={caps.allowWebSearch} onChange={() => toggle('allowWebSearch')} />
        <ToggleRow label="Travel & bookings" checked={caps.allowTravel} onChange={() => toggle('allowTravel')} />
        <ToggleRow label="Payments & invoices" checked={caps.allowPayments} onChange={() => toggle('allowPayments')} />
        <ToggleRow label="Reminders" checked={caps.allowReminders} onChange={() => toggle('allowReminders')} />
        <ToggleRow label="Send email" checked={caps.allowEmail} onChange={() => toggle('allowEmail')} />
        <ToggleRow label="Send WhatsApp" checked={caps.allowWhatsapp} onChange={() => toggle('allowWhatsapp')} />
        <ToggleRow label="Scheduling" checked={caps.allowCalendar} onChange={() => toggle('allowCalendar')} />
      </SectionCard>

      <button className={styles.btnPrimary} onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save Controls'}
      </button>
    </div>
  )
}
