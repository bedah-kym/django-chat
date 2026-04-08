import { useState } from 'react'
import { toast } from 'sonner'
import { connectIntegration } from '../settingsApi'
import styles from './IntegrationModal.module.css'

type IntegrationType = 'whatsapp' | 'intasend' | 'gmail'

interface Props {
  type: IntegrationType
  onClose: () => void
  onConnected: () => void
}

const CONFIG = {
  whatsapp: {
    title: 'Connect WhatsApp Business',
    fields: [
      { key: 'account_sid', label: 'Twilio Account SID', placeholder: 'ACxxxxxxxxxxxxxxxx', type: 'text' },
      { key: 'auth_token', label: 'Auth Token', placeholder: '••••••••••••••••', type: 'password' },
      { key: 'phone_number', label: 'WhatsApp Number', placeholder: '+1234567890', type: 'text' },
    ],
  },
  intasend: {
    title: 'Connect IntaSend Pay',
    fields: [
      { key: 'public_key', label: 'Public Key', placeholder: 'ISPubKey_live_…', type: 'text' },
      { key: 'api_key', label: 'API Key / Secret', placeholder: 'ISSecretKey_live_…', type: 'password' },
    ],
  },
  gmail: {
    title: 'Connect Gmail',
    fields: [],
  },
}

export function IntegrationModal({ type, onClose, onConnected }: Props) {
  const config = CONFIG[type]
  const [values, setValues] = useState<Record<string, string>>({})
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox')
  const [saving, setSaving] = useState(false)

  function setValue(key: string, val: string) {
    setValues(prev => ({ ...prev, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const creds = type === 'intasend'
        ? { ...values, is_test: environment === 'sandbox' }
        : values
      await connectIntegration(type, creds)
      toast.success('Integration connected')
      onConnected()
      onClose()
    } catch {
      toast.error('Failed to connect — check your credentials')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>{config.title}</span>
          <button className={styles.close} onClick={onClose} type="button" aria-label="Close">×</button>
        </div>

        {type === 'gmail' ? (
          <div className={styles.body}>
            <p className={styles.oauthNote}>
              Connecting Gmail will redirect you to Google to authorise access.
              Only send permission is requested — Kazi will not read your emails.
            </p>
            <button
              className={styles.btnPrimary}
              onClick={() => {
                // TODO: redirect to /accounts/integrations/gmail/connect/
                toast.info('Redirecting to Google…')
                onClose()
              }}
              type="button"
            >
              Continue with Google
            </button>
          </div>
        ) : (
          <form className={styles.body} onSubmit={handleSubmit}>
            {config.fields.map(f => (
              <label key={f.key} className={styles.field}>
                <span className={styles.fieldLabel}>{f.label}</span>
                <input
                  className={styles.input}
                  type={f.type}
                  placeholder={f.placeholder}
                  value={values[f.key] ?? ''}
                  onChange={e => setValue(f.key, e.target.value)}
                  required
                  autoComplete="off"
                />
              </label>
            ))}

            {type === 'intasend' && (
              <div className={styles.envToggle}>
                <span className={styles.fieldLabel}>Environment</span>
                <div className={styles.envPills}>
                  <button
                    type="button"
                    className={`${styles.envPill} ${environment === 'sandbox' ? styles.envActive : ''}`}
                    onClick={() => setEnvironment('sandbox')}
                  >
                    Sandbox
                  </button>
                  <button
                    type="button"
                    className={`${styles.envPill} ${environment === 'production' ? styles.envActive : ''}`}
                    onClick={() => setEnvironment('production')}
                  >
                    Production
                  </button>
                </div>
              </div>
            )}

            <div className={styles.footer}>
              <button className={styles.btnOutline} type="button" onClick={onClose}>
                Cancel
              </button>
              <button className={styles.btnPrimary} type="submit" disabled={saving}>
                {saving ? 'Connecting…' : 'Connect'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
