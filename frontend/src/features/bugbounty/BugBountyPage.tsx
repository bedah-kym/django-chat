import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { BanknoteArrowDown, Boxes, Building2, Cloud, CloudOff, FileText, Inbox, Megaphone, RefreshCcw, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useBugBountyStore } from '@/stores/bugbountyStore'
import { ProgramCard } from './components/ProgramCard'
import { BountyTracker } from './components/BountyTracker'
import { ReportDraftModal } from './components/ReportDraftModal'
import { ReportRow } from './components/ReportRow'
import { formatCurrency, formatDateTime } from '@/utils/format'
import { RouteSkeleton } from '@/components/ui/RouteSkeleton'
import { useDelayedFlag } from '@/hooks/useDelayedFlag'
import styles from './BugBountyPage.module.css'

const FILTERS = ['All', 'HackerOne', 'Bugcrowd', 'Intigriti'] as const

export function BugBountyPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All')
  const [showDraft, setShowDraft] = useState(false)
  const programs = useBugBountyStore((s) => s.programs)
  const reports = useBugBountyStore((s) => s.reports)
  const drafts = useBugBountyStore((s) => s.drafts)
  const campaigns = useBugBountyStore((s) => s.campaigns)
  const assets = useBugBountyStore((s) => s.assets)
  const orgs = useBugBountyStore((s) => s.orgs)
  const isLoading = useBugBountyStore((s) => s.isLoading)
  const initialize = useBugBountyStore((s) => s.initialize)
  const hackeroneStatus = useBugBountyStore((s) => s.hackeroneStatus)
  const isSyncing = useBugBountyStore((s) => s.isSyncing)
  const lastSyncResult = useBugBountyStore((s) => s.lastSyncResult)
  const syncError = useBugBountyStore((s) => s.syncError)
  const syncHackerOne = useBugBountyStore((s) => s.syncHackerOne)
  const loadHackerOneStatus = useBugBountyStore((s) => s.loadHackerOneStatus)
  const showSkeleton = useDelayedFlag(isLoading && programs.length === 0)

  useEffect(() => { initialize() }, [initialize])
  useEffect(() => { loadHackerOneStatus() }, [loadHackerOneStatus])

  const canSync = Boolean(hackeroneStatus?.isOwnerOrStaff && hackeroneStatus?.configured)

  const handleSync = async () => {
    try {
      await syncHackerOne()
      toast.success('HackerOne synced')
    } catch {
      // Error is surfaced via syncError in the store.
    }
  }

  const h1Configured = Boolean(hackeroneStatus?.configured)
  const h1Enabled = Boolean(hackeroneStatus?.enabled)
  const h1Label = h1Configured
    ? `HackerOne · ${hackeroneStatus?.ownerUsername ?? 'connected'}`
    : h1Enabled
      ? 'HackerOne · keys missing'
      : 'HackerOne · disabled'

  if (showSkeleton) return <RouteSkeleton />

  const filteredPrograms = filter === 'All'
    ? programs
    : programs.filter(program => program.platform === filter)

  const totalEarned = reports.reduce((sum, report) => sum + report.bountyKes, 0)
  const openReports = reports.filter(report => ['draft', 'triaged'].includes(report.status)).length

  const stats = [
    { label: 'Total Earned', value: formatCurrency(totalEarned), icon: BanknoteArrowDown },
    { label: 'Open Reports', value: openReports, icon: FileText },
    { label: 'Programs', value: programs.length, icon: ShieldCheck },
    { label: 'Campaigns', value: campaigns.length, icon: Megaphone },
    { label: 'Assets', value: assets.length, icon: Boxes },
  ]

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.heading}>
          <h1 className={styles.title}>Bug Bounty</h1>
          <p className={styles.subtitle}>Programs and reports across HackerOne, Bugcrowd and Intigriti.</p>
        </div>
        <div className={styles.headerActions}>
          {orgs.length > 0 && (
            <span className={styles.statusPill}>
              <Building2 size={14} />
              {orgs[0]?.handle} · {orgs[0]?.memberCount} members
            </span>
          )}
          <span className={`${styles.statusPill} ${h1Configured ? styles.ok : h1Enabled ? styles.warn : styles.off}`}>
            {h1Configured ? <Cloud size={14} /> : <CloudOff size={14} />}
            {h1Label}
          </span>
          {canSync && (
            <button type="button" className={styles.syncBtn} onClick={handleSync} disabled={isSyncing}>
              <RefreshCcw size={15} className={isSyncing ? styles.spinning : undefined} />
              {isSyncing ? 'Syncing…' : 'Sync HackerOne'}
            </button>
          )}
        </div>
      </header>

      {syncError && <div className={styles.bannerError}>{syncError}</div>}
      {lastSyncResult && (
        <div className={styles.bannerSuccess}>
          Synced {lastSyncResult.programs_created + lastSyncResult.programs_updated} programs,{' '}
          {lastSyncResult.reports_created + lastSyncResult.reports_updated} reports
          {lastSyncResult.reports_skipped ? ` (${lastSyncResult.reports_skipped} skipped)` : ''}.
        </div>
      )}

      <div className={styles.statsRow}>
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={stat.label}
              className={styles.statCard}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className={styles.statIcon}><Icon size={20} /></div>
              <div className={styles.statValue}>{stat.value}</div>
              <div className={styles.statLabel}>{stat.label}</div>
            </motion.div>
          )
        })}
      </div>

      <BountyTracker />

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Programs</h2>
          <div className={styles.filters}>
            {FILTERS.map(item => (
              <button
                key={item}
                type="button"
                className={`${styles.filterPill} ${filter === item ? styles.filterActive : ''}`}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {filteredPrograms.length === 0 ? (
          <div className={styles.emptyState}>
            <Inbox size={22} />
            <p>No {filter === 'All' ? '' : `${filter} `}programs yet.</p>
            {canSync && (
              <button type="button" className={styles.linkBtn} onClick={handleSync} disabled={isSyncing}>
                Sync HackerOne
              </button>
            )}
          </div>
        ) : (
          <div className={styles.programGrid}>
            {filteredPrograms.map(program => <ProgramCard key={program.id} program={program} />)}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Campaigns</h2>
        </div>

        {campaigns.length === 0 ? (
          <div className={styles.emptyState}>
            <Megaphone size={22} />
            <p>No campaigns yet. Launch one in HackerOne to boost bounties.</p>
          </div>
        ) : (
          <div className={styles.campaignGrid}>
            {campaigns.map(campaign => (
              <div key={campaign.id} className={styles.campaignCard}>
                <div className={styles.campaignTop}>
                  <span className={styles.campaignName}>{campaign.name}</span>
                  {campaign.multiplier && <span className={styles.multiplierBadge}>{campaign.multiplier}</span>}
                </div>
                {campaign.status && <span className={styles.campaignStatus}>{campaign.status}</span>}
                {(campaign.startsAt || campaign.endsAt) && (
                  <div className={styles.campaignDates}>
                    {campaign.startsAt ? formatDateTime(campaign.startsAt) : '—'} →{' '}
                    {campaign.endsAt ? formatDateTime(campaign.endsAt) : 'open-ended'}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Assets</h2>
        </div>

        {assets.length === 0 ? (
          <div className={styles.emptyState}>
            <Boxes size={22} />
            <p>No assets yet. Add assets in HackerOne to define your scope.</p>
          </div>
        ) : (
          <div className={styles.assetList}>
            {assets.map(asset => (
              <div key={asset.id} className={styles.assetChip}>
                <span className={styles.assetType}>{asset.assetType || 'asset'}</span>
                <span className={styles.assetIdentifier}>{asset.identifier}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Reports</h2>
          <div className={styles.reportActions}>
            <Link to="/app/security/bugbounty/reports" className={styles.linkBtn}>All Reports</Link>
            {drafts.length > 0 && (
              <button type="button" className={styles.secondaryBtn} onClick={() => setShowDraft(true)}>Review Draft</button>
            )}
          </div>
        </div>

        {reports.length === 0 ? (
          <div className={styles.emptyState}>
            <FileText size={22} />
            <p>No reports yet. Sync HackerOne to pull them in.</p>
          </div>
        ) : (
          <div className={styles.list}>
            {reports.slice(0, 8).map(report => <ReportRow key={report.id} report={report} />)}
          </div>
        )}
      </section>

      {showDraft && drafts[0] && <ReportDraftModal draft={drafts[0]} onClose={() => setShowDraft(false)} />}
    </div>
  )
}
