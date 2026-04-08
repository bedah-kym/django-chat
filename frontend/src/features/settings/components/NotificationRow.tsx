import type { NotificationChannel } from '@/types/user'
import styles from './NotificationRow.module.css'

interface Props {
  label: string
  value: NotificationChannel
  onChange: (value: NotificationChannel) => void
}

const CHANNELS: { key: keyof NotificationChannel; label: string }[] = [
  { key: 'inApp', label: 'In-App' },
  { key: 'email', label: 'Email' },
  { key: 'whatsapp', label: 'WhatsApp' },
]

export function NotificationRow({ label, value, onChange }: Props) {
  function toggle(channel: keyof NotificationChannel) {
    onChange({ ...value, [channel]: !value[channel] })
  }

  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <div className={styles.channels}>
        {CHANNELS.map(ch => (
          <button
            key={ch.key}
            type="button"
            className={`${styles.chip} ${value[ch.key] ? styles.chipOn : ''}`}
            onClick={() => toggle(ch.key)}
            aria-pressed={value[ch.key]}
          >
            {ch.label}
          </button>
        ))}
      </div>
    </div>
  )
}
