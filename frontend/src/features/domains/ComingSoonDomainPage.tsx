import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import type { DomainId } from '@/types/domain'
import { domainConfigs, domainStatusCopy, getRoomPath } from '@/domains'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { MetricStrip } from '@/components/ui/MetricStrip'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { mockDomainWorkspaces } from '@/mocks/domainWorkspaces'
import { useChatStore } from '@/stores/chatStore'
import { formatDateTime } from '@/utils/format'
import styles from './ComingSoonDomainPage.module.css'

interface Props {
  domainId: DomainId
}

export function ComingSoonDomainPage({ domainId }: Props) {
  const domain = domainConfigs[domainId]
  const workspace = mockDomainWorkspaces[domainId]
  const rooms = useChatStore((s) => s.rooms)
  const recentRooms = useMemo(
    () => rooms.filter((room) => room.domain === domainId).slice(0, 3),
    [rooms, domainId],
  )

  if (!workspace) {
    const Icon = domain.icon

    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.iconWrap}><Icon size={22} /></div>
          <h2 className={styles.title}>{domain.label}</h2>
          <p className={styles.description}>{domain.description}</p>
          <p className={styles.note}>{domainStatusCopy[domainId]}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.workspacePage}>
      <SectionHeader
        eyebrow={workspace.eyebrow}
        title={workspace.title}
        description={workspace.description}
        action={<StatusBadge label="Mock workspace data" tone="info" />}
      />

      <MetricStrip items={workspace.metrics} />

      <div className={styles.workspaceGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <div className={styles.panelTitle}>Current queue</div>
              <div className={styles.panelSubtitle}>{domainStatusCopy[domainId]}</div>
            </div>
          </div>
          <div className={styles.feedList}>
            {workspace.feed.map((item) => (
              <article key={item.id} className={styles.feedItem}>
                <div className={styles.feedMain}>
                  <div className={styles.feedTitleRow}>
                    <h3 className={styles.feedTitle}>{item.title}</h3>
                    <StatusBadge label={item.tone === 'critical' ? 'Attention' : item.tone === 'warning' ? 'Watch' : item.tone === 'success' ? 'Ready' : 'Update'} tone={item.tone} />
                  </div>
                  <p className={styles.feedDetail}>{item.detail}</p>
                </div>
                <time className={styles.feedTime} dateTime={item.timestamp}>
                  {formatDateTime(item.timestamp)}
                </time>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.stack}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.panelTitle}>Priority actions</div>
                <div className={styles.panelSubtitle}>Short-list the work that keeps the domain moving.</div>
              </div>
            </div>
            <div className={styles.actionList}>
              {workspace.actions.map((action) => (
                <article key={action.id} className={styles.actionItem}>
                  <div className={styles.actionTop}>
                    <h3 className={styles.actionLabel}>{action.label}</h3>
                    <StatusBadge label={action.status} tone={action.tone} />
                  </div>
                  <p className={styles.actionDetail}>{action.detail}</p>
                  <div className={styles.actionOwner}>Owner: {action.owner}</div>
                </article>
              ))}
            </div>
          </section>

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
