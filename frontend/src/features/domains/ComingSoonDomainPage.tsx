import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import type { DomainId } from '@/types/domain'
import { domainConfigs, domainStatusCopy, getRoomPath } from '@/domains'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { MetricStrip } from '@/components/ui/MetricStrip'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useChatStore } from '@/stores/chatStore'
import styles from './ComingSoonDomainPage.module.css'

interface Props {
  domainId: DomainId
}

export function ComingSoonDomainPage({ domainId }: Props) {
  const domain = domainConfigs[domainId]
  const rooms = useChatStore((s) => s.rooms)
  const recentRooms = useMemo(
    () => rooms.filter((room) => room.domain === domainId).slice(0, 3),
    [rooms, domainId],
  )

  const workspace = useMemo(() => ({
    eyebrow: domain.label,
    title: `${domain.label} workspace`,
    description: domain.description,
    metrics: [
      { label: 'Rooms', value: String(recentRooms.length), detail: 'Active rooms in this domain', tone: 'info' as const },
    ],
    feed: [] as { id: string; title: string; detail: string; timestamp: string; tone?: 'default' | 'success' | 'warning' | 'critical' | 'info' | 'muted' }[],
    actions: [] as { id: string; label: string; detail: string; owner: string; status: string; tone?: 'default' | 'success' | 'warning' | 'critical' | 'info' | 'muted' }[],
  }), [domain, recentRooms.length])

  return (
    <div className={styles.workspacePage}>
      <SectionHeader
        eyebrow={workspace.eyebrow}
        title={workspace.title}
        description={workspace.description}
        action={<StatusBadge label="Coming soon" tone="info" />}
      />

      <MetricStrip items={workspace.metrics} />

      <div className={styles.workspaceGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <div className={styles.panelTitle}>Status</div>
              <div className={styles.panelSubtitle}>{domainStatusCopy[domainId]}</div>
            </div>
          </div>
        </section>

        <section className={styles.stack}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.panelTitle}>Active rooms</div>
                <div className={styles.panelSubtitle}>Use the local room rail or jump straight into the busiest threads.</div>
              </div>
            </div>
            <div className={styles.roomList}>
              {recentRooms.map((room) => (
                <Link key={room.id} to={getRoomPath(room)} className={styles.roomCard}>
                  <div className={styles.roomName}>{room.displayName}</div>
                  <div className={styles.roomPreview}>{room.lastMessage}</div>
                </Link>
              ))}
            </div>
          </section>
        </section>
      </div>
    </div>
  )
}
