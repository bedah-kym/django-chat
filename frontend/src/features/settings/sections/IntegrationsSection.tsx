import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import type { Integration } from '@/types/user'
import {
  connectCalendly,
  disconnectCalendly,
  disconnectIntegration,
  fetchCalendlyEvents,
  fetchCalendlyEventTypes,
  setCalendlyEventType,
  type CalendlyEvent,
  type CalendlyEventType,
} from '../settingsApi'
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

  // ── Calendly enriched state ──────────────────────────────────────────
  const [calendlyEvents, setCalendlyEvents] = useState<CalendlyEvent[]>([])
  const [calendlyEventTypes, setCalendlyEventTypes] = useState<CalendlyEventType[]>([])
  const [selectedEventTypeUri, setSelectedEventTypeUri] = useState<string | null>(null)
  const [calendlyExpanded, setCalendlyExpanded] = useState(false)

  const calendlyConnected = localIntegrations.find(i => i.type === 'calendly')?.connected === true

  const loadCalendlyDetails = useCallback(async () => {
    if (!calendlyConnected) return
    try {
      const [eventsData, typesData] = await Promise.all([
        fetchCalendlyEvents(),
        fetchCalendlyEventTypes(),
      ])
      setCalendlyEvents(eventsData.events ?? [])
      setCalendlyEventTypes(typesData.event_types ?? [])
      setSelectedEventTypeUri(typesData.selected_uri ?? null)
    } catch {
      // Silently ignore — user might have expired token
    }
  }, [calendlyConnected])

  useEffect(() => {
    loadCalendlyDetails()
  }, [loadCalendlyDetails])

  async function handleSetEventType(et: CalendlyEventType) {
    try {
      await setCalendlyEventType(et.uri, et.name, et.scheduling_url)
      setSelectedEventTypeUri(et.uri)
      toast.success(`Event type set to "${et.name}"`)
    } catch {
      toast.error('Failed to set event type')
    }
  }

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

  // Always render every known provider so the user can connect from a blank
  // state. The server returns only the *connected* set; we merge in the rest
  // as "Not connected" placeholders so the section is never an empty void.
  const ALL_PROVIDERS: Integration['type'][] = ['whatsapp', 'gmail', 'intasend', 'calendly']
  const displayed: Integration[] = ALL_PROVIDERS.map(type => {
    const existing = localIntegrations.find(i => i.type === type)
    return existing ?? { type, connected: false }
  })

  return (
    <>
      <div className={styles.integrationGrid}>
        {displayed.map(int => {
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

              {/* ── Calendly: upcoming events + event type picker ────────── */}
              {int.type === 'calendly' && int.connected && calendlyExpanded && (
                <div className={styles.calendlyDetail}>
                  {/* Event types selector */}
                  {calendlyEventTypes.length > 0 && (
                    <div className={styles.calendlySection}>
                      <span className={styles.calendlySectionTitle}>Event Types</span>
                      <div className={styles.eventTypeList}>
                        {calendlyEventTypes.map(et => (
                          <button
                            key={et.uri}
                            type="button"
                            className={`${styles.eventTypeItem} ${et.uri === selectedEventTypeUri ? styles.eventTypeSelected : ''}`}
                            onClick={() => handleSetEventType(et)}
                          >
                            <span className={styles.eventTypeName}>{et.name}</span>
                            {et.duration != null && (
                              <span className={styles.eventTypeDuration}>{et.duration}min</span>
                            )}
                            {et.uri === selectedEventTypeUri && (
                              <span className={styles.eventTypeCheck}>✓</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upcoming events */}
                  <div className={styles.calendlySection}>
                    <span className={styles.calendlySectionTitle}>
                      Upcoming Events ({calendlyEvents.length})
                    </span>
                    {calendlyEvents.length === 0 ? (
                      <p className={styles.calendlyEmpty}>No upcoming events</p>
                    ) : (
                      <div className={styles.eventList}>
                        {calendlyEvents.slice(0, 5).map((ev, i) => (
                          <div key={ev.uri || i} className={styles.eventItem}>
                            <span className={styles.eventTitle}>{ev.title}</span>
                            <span className={styles.eventTime}>
                              {ev.start ? new Date(ev.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                            {ev.invitee && (
                              <span className={styles.eventInvitee}>{ev.invitee}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {int.type === 'calendly' && int.connected && (
                <button
                  type="button"
                  className={styles.btnLink}
                  onClick={() => { setCalendlyExpanded(!calendlyExpanded); if (!calendlyExpanded) loadCalendlyDetails() }}
                >
                  {calendlyExpanded ? '▲ Hide details' : '▼ Show events & types'}
                </button>
              )}
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
