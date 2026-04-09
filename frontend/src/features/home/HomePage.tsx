import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { domainConfigs, domainOrder, getRoomPath } from '@/domains'
import { mockEngagements, mockFindings } from '@/mocks/pentest'
import { mockReports } from '@/mocks/bugBounty'
import { mockWallet } from '@/mocks/payments'
import { useChatStore } from '@/stores/chatStore'
import { uiCopy } from '@/content/uiCopy'
import { formatCompactNumber, formatCurrency } from '@/utils/format'
import { PageScaffold } from '@/components/ui/PageScaffold'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { MetricStrip } from '@/components/ui/MetricStrip'
import { StatusBadge } from '@/components/ui/StatusBadge'
import styles from './HomePage.module.css'

export function HomePage() {
  const rooms = useChatStore((state) => state.rooms)
  const totalUnread = rooms.reduce((sum, room) => sum + room.unreadCount, 0)
  const criticalFindings = mockFindings.filter((finding) => finding.severity === 'critical').length
  const activeEngagement = mockEngagements.find((engagement) => engagement.status === 'running') ?? mockEngagements[0]
  const primaryRoom = rooms.find((room) => room.domain === 'security')

  const metrics = [
    {
      label: 'Unread items',
      value: formatCompactNumber(totalUnread + mockReports.filter((report) => report.status === 'draft').length),
      detail: 'Messages, drafts, and operator actions waiting.',
      tone: 'warning' as const,
    },
    {
      label: 'Critical findings',
      value: formatCompactNumber(criticalFindings),
      detail: 'Open issues requiring validation or escalation.',
      tone: 'critical' as const,
    },
    {
      label: 'Active engagements',
      value: formatCompactNumber(mockEngagements.filter((engagement) => engagement.status === 'running').length),
      detail: 'Authorized jobs currently in progress.',
      tone: 'info' as const,
    },
    {
      label: 'Available cash',
      value: formatCurrency(mockWallet.balance),
      detail: 'Operational balance available for work this week.',
      tone: 'success' as const,
    },
  ]

  return (
    <PageScaffold
      eyebrow={uiCopy.shell.globalEyebrow}
      title={uiCopy.shell.homeTitle}
      description="Operational overview across workspaces, rooms, and pending actions."
      mode="overview"
    >
      <div className={styles.stack}>
        <MetricStrip items={metrics} />

        <div className={styles.mainGrid}>
          <section className={styles.panel}>
            <SectionHeader
              eyebrow="Priority queue"
              title="What needs action next"
              description="Highest-value operator moves across the product."
            />
            <div className={styles.signalList}>
              <Link to="/app/security/pentest" className={styles.signalItem}>
                <strong>Review active engagement</strong>
                <span>{activeEngagement?.target} is running and still has a critical issue ready for validation.</span>
              </Link>
              {primaryRoom ? (
                <Link to={getRoomPath(primaryRoom)} className={styles.signalItem}>
                  <strong>Open security room</strong>
                  <span>Security Briefing contains the latest AI check-in and operator coordination thread.</span>
                </Link>
              ) : null}
              <Link to="/app/settings" className={styles.signalItem}>
                <strong>Confirm workspace defaults</strong>
                <span>Locale, currency, direction, and density are now configurable at the shell level.</span>
              </Link>
            </div>
          </section>

          <section className={styles.panel}>
            <SectionHeader
              eyebrow="Live status"
              title="Current system state"
              description="Fast read before you enter a workspace."
            />
            <div className={styles.systemSummary}>
              <div className={styles.summaryRow}>
                <span>Security</span>
                <StatusBadge label={`${criticalFindings} critical`} tone="critical" />
              </div>
              <div className={styles.summaryRow}>
                <span>Unread rooms</span>
                <StatusBadge label={`${totalUnread} unread`} tone={totalUnread > 0 ? 'warning' : 'muted'} />
              </div>
              <div className={styles.summaryRow}>
                <span>Wallet</span>
                <span className={styles.summaryValue}>{formatCurrency(mockWallet.balance)}</span>
              </div>
            </div>
          </section>
        </div>

        <section className={styles.domainSection}>
          <SectionHeader
            eyebrow="Workspaces"
            title="Jump into a workspace"
            description="Use the shell to choose the correct context, not to read a presentation."
          />

          <div className={styles.domainList}>
            {domainOrder.map((domainId) => {
              const domain = domainConfigs[domainId]
              const room = rooms.find((item) => item.domain === domainId)
              const href = room ? getRoomPath(room) : domain.defaultRoute
              const queueCount = rooms.filter((item) => item.domain === domainId).reduce((sum, item) => sum + item.unreadCount, 0)

              return (
                <Link key={domainId} to={href} className={styles.domainRow}>
                  <div className={styles.domainPrimary}>
                    <div className={styles.domainTitleRow}>
                      <span className={styles.domainName}>{domain.label}</span>
                      <StatusBadge
                        label={queueCount > 0 ? `${queueCount} unread` : 'Stable'}
                        tone={queueCount > 0 ? 'warning' : 'muted'}
                      />
                    </div>
                    <p className={styles.domainDescription}>{domain.description}</p>
                  </div>
                  <span className={styles.domainLink}>
                    Open
                    <ArrowRight size={14} />
                  </span>
                </Link>
              )
            })}
          </div>
        </section>

        <div className={styles.lowerGrid}>
          <section className={styles.panel}>
            <SectionHeader
              eyebrow="Signals"
              title="What changed most recently"
              description="Read this first if you only have two minutes."
            />
            <div className={styles.signalList}>
              <div className={styles.signalItemStatic}>
                <strong>Approval waiting</strong>
                <span>High-risk enumeration step for {activeEngagement?.target} still needs confirmation.</span>
              </div>
              <div className={styles.signalItemStatic}>
                <strong>Draft bounty report</strong>
                <span>{mockReports.filter((report) => report.status === 'draft').length} report draft is ready for refinement and submission.</span>
              </div>
              <div className={styles.signalItemStatic}>
                <strong>Unread coordination</strong>
                <span>{totalUnread} unread room messages still need triage across the product.</span>
              </div>
            </div>
          </section>

          <section className={styles.panel}>
            <SectionHeader
              eyebrow="Next actions"
              title="Suggested moves"
              description="Fast entry points for the most likely operator path."
            />
            <div className={styles.actionList}>
              <Link to="/app/security" className={styles.actionItem}>Open security overview</Link>
              <Link to="/app/security/pentest/new" className={styles.actionItem}>Start a new engagement</Link>
              <Link to="/app/settings" className={styles.actionItem}>Set locale, direction, and workspace defaults</Link>
            </div>
          </section>
        </div>
      </div>
    </PageScaffold>
  )
}
