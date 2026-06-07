import { useState } from 'react'
import { toast } from 'sonner'
import type { Integration } from '@/types/user'
import { connectCalendly, disconnectCalendly, disconnectIntegration } from '../settingsApi'
import { IntegrationModal } from '../components/IntegrationModal'
import styles from '../SettingsPage.module.css'

interface Props {
  integrations: Integration[]
}

type ModalType = 'whatsapp' | 'intasend' | 'gmail' | null

const INTEGRATION_META: Record<string, { name: string; description: string }> = {
  whatsapp: { name: 'WhatsApp Business', description: 'Send and receive messages via Twilio' },
  gmail: { name: 'Gmail', description: 'Send emails directly from Kazi' },
  intasend: { name: 'IntaSend Pay', description: 'M-Pesa, Card & Bank payments (Kenya)' },
  calendly: { name: 'Calendly', description: 'Client meeting scheduling' },
}

export function IntegrationsSection({ integrations }: Props) {
  const [localIntegrations, setLocalIntegrations] = useState<Integration[]>(integrations)
  const [openModal, setOpenModal] = useState<ModalType>(null)
  const [loading, setLoading] = useState<string | null>(null)

  function markConnected(type: Integration['type']) {
    setLocalIntegrations(prev =>
      prev.map(i => (i.type === type ? { ...i, connected: true } : i))
    )
  }

  function markDisconnected(type: Integration['type']) {
    setLocalIntegrations(prev =>
      prev.map(i =>
        i.type === type ? { ...i, connected: false, accountName: undefined } : i
      )
    )
  }

  async function handleConnect(type: Integration['type']) {
    if (type === 'calendly') {
      setLoading('calendly')
      try {
        const { authorization_url } = await connectCalendly()
        window.location.href = authorization_url
      } catch {
        toast.error('Failed to start Calendly connection')
        setLoading(null)
      }
      return
    }
    setOpenModal(type as ModalType)
  }

  async function handleDisconnect(type: Integration['type']) {
    setLoading(type)
    try {
      if (type === 'calendly') {
        await disconnectCalendly()
      } else {
        await disconnectIntegration(type)
      }
      markDisconnected(type)
      toast.success(`${INTEGRATION_META[type]?.name ?? type} disconnected`)
    } catch {
      toast.error('Failed to disconnect')
    } finally {
      setLoading(null)
    }
  }

  return (
    <>
      <div className={styles.integrationGrid}>
        {localIntegrations.map(int => {
          const meta = INTEGRATION_META[int.type]
          const isLoading = loading === int.type
          return (
            <div key={int.type} className={styles.integrationCard}>
              <div className={styles.integrationHeader}>
                <span className={styles.integrationName}>{meta?.name ?? int.type}</span>
                <span className={`${styles.statusBadge} ${int.connected ? styles.connected : styles.disconnected}`}>
                  {int.connected ? 'Connected' : 'Not connected'}
                </span>
              </div>
              {meta?.description && (
                <p className={styles.integrationAccount}>{meta.description}</p>
              )}
              {int.connected && int.accountName && (
                <p className={styles.integrationConnectedAs}>↳ {int.accountName}</p>
              )}
              <button
                className={int.connected ? styles.btnDanger : styles.btnOutline}
                onClick={() => int.connected ? handleDisconnect(int.type) : handleConnect(int.type)}
                disabled={isLoading}
                type="button"
              >
                {isLoading ? '…' : int.connected ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          )
        })}
      </div>

      {openModal && (
        <IntegrationModal
          type={openModal}
          onClose={() => setOpenModal(null)}
          onConnected={() => markConnected(openModal as Integration['type'])}
        />
      )}
    </>
  )
}
