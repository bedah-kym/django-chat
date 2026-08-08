import { Link } from 'react-router-dom'
import { usePentestStore } from '@/stores/pentestStore'
import { useBugBountyStore } from '@/stores/bugbountyStore'
import { useChatStore } from '@/stores/chatStore'
import { getRoomPath } from '@/domains'
import { uiCopy } from '@/content/uiCopy'
import { formatDateTime } from '@/utils/format'
import { PageScaffold } from '@/components/ui/PageScaffold'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { MetricStrip } from '@/components/ui/MetricStrip'
import { StatusBadge } from '@/components/ui/StatusBadge'
import styles from './SecurityDomainPage.module.css'

export function SecurityDomainPage() {
  const rooms = useChatStore((state) => state.rooms)
  const securityRooms = rooms.filter((room) => room.domain === 'security')
  const engagements = usePentestStore((s) => s.engagements)
  const findings = usePentestStore((s) => s.findings)
  const programs = useBugBountyStore((s) => s.programs)
  const reports = useBugBountyStore((s) => s.reports)
  const fallbackEngagement = engagements[0]
  if (!fallbackEngagement) return null
  const activeEngagement = engagements.find((engagement) => engagement.status === 'running') ?? fallbackEngagement
  const reviewQueue = findings.slice(0, 3)

  const metrics = [
    { label: 'Engagements', value: String(engagements.length), detail: 'Authorized jobs across active clients.' },
    { label: 'Findings', value: String(findings.length), detail: 'Validated and in-progress issues.' },
    { label: 'Reports', value: String(reports.length), detail: 'Drafts, triage, and paid bounty work.' },
    { label: 'Programs', value: String(programs.length), detail: 'Enrolled programs with active scan coverage.' },
  ]

  return (
    <PageScaffold
      eyebrow={uiCopy.security.overviewEyebrow}
      title={uiCopy.security.overviewTitle}
      description={uiCopy.security.overviewSubtitle}
      mode="overview"
    >
      <div className={styles.stack}>
        <MetricStrip items={metrics} />

        <div className={styles.grid}>
          <section className={styles.heroPanel}>
            <SectionHeader
              eyebrow="Live engagement"
              title={activeEngagement.target}
              description={activeEngagement.activeActivity}
              action={<Link to="/app/security/pentest" className={styles.inlineLink}>Open pentest queue</Link>}
            />
            <div className={styles.heroMeta}>
              <StatusBadge label={activeEngagement.status} tone="success" />
              <StatusBadge label={activeEngagement.phase} tone="info" />
              <span>{activeEngagement.scopeCount} scoped assets</span>
              <span>Authorized until {activeEngagement.expiry}</span>
            </div>
            <div className={styles.signalGrid}>
              <div className={styles.signalCard}>
                <strong>{activeEngagement.findings.critical}</strong>
                <span>Critical issues</span>
              </div>
              <div className={styles.signalCard}>
                <strong>{activeEngagement.findings.high}</strong>
                <span>High issues</span>
              </div>
              <div className={styles.signalCard}>
                <strong>{reports.filter((report) => report.status === 'draft').length}</strong>
                <span>Draft reports</span>
              </div>
            </div>
          </section>

          <section className={styles.panel}>
            <SectionHeader eyebrow="Queue" title="Review queue" description="Read this first before opening tools." />
            <div className={styles.list}>
              {reviewQueue.map((item) => (
                <Link key={item.id} to={`/app/security/pentest/${item.engagementId}`} className={styles.row}>
                  <div>
                    <div className={styles.primary}>{item.title}</div>
                    <div className={styles.secondary}>{item.target}</div>
                  </div>
                  <StatusBadge label={item.severity} tone={item.severity === 'critical' ? 'critical' : item.severity === 'high' ? 'warning' : 'muted'} />
                </Link>
              ))}
            </div>
          </section>
        </div>

        <div className={styles.grid}>
          <section className={styles.panel}>
            <SectionHeader eyebrow="Rooms" title="Security coordination" description="Analyst conversations stay inside the workspace context." />
            <div className={styles.list}>
              {securityRooms.map((room) => (
                <Link key={room.id} to={getRoomPath(room)} className={styles.row}>
                  <div>
                    <div className={styles.primary}>{room.displayName}</div>
                    <div className={styles.secondary}>{room.lastMessage}</div>
                  </div>
                  <StatusBadge label={room.unreadCount > 0 ? `${room.unreadCount} unread` : 'Clear'} tone={room.unreadCount > 0 ? 'warning' : 'muted'} />
                </Link>
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <SectionHeader eyebrow="Programs" title="Recent bounty activity" description="Program coverage and submission freshness." />
            <div className={styles.list}>
              {programs.map((program) => (
                <div key={program.id} className={styles.rowStatic}>
                  <div>
                    <div className={styles.primary}>{program.name}</div>
                    <div className={styles.secondary}>Last scan {formatDateTime(program.lastScannedAt)}</div>
                  </div>
                  <StatusBadge label={program.scanStatus} tone={program.scanStatus === 'running' ? 'success' : 'info'} />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </PageScaffold>
  )
}
