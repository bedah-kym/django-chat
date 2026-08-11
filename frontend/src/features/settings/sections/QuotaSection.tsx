import { useEffect } from 'react'
import { RefreshCw, Clock, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { useQuotaStore } from '@/stores/quotaStore'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { SectionCard } from '../components/SectionCard'
import type { QuotaCategory } from '@/types/quota'
import styles from './QuotaSection.module.css'

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  trial: 'Trial',
  pro: 'Pro',
  agency: 'Agency',
}

const STATUS_LABELS: Record<QuotaCategory['status'], string> = {
  good: 'OK',
  warning: 'Warning',
  critical: 'Critical',
  exhausted: 'Exhausted',
}

function QuotaCard({ category }: { category: QuotaCategory }) {
  const pct = category.limit > 0 ? Math.min(100, (category.used / category.limit) * 100) : 0
  const fillClass =
    category.status === 'exhausted' ? styles.fillExhausted :
    category.status === 'critical' ? styles.fillCritical :
    category.status === 'warning' ? styles.fillWarning :
    styles.fillGood
  const statusClass =
    category.status === 'exhausted' ? styles.statusExhausted :
    category.status === 'critical' ? styles.statusCritical :
    category.status === 'warning' ? styles.statusWarning :
    styles.statusGood

  return (
    <div className={styles.quotaCard}>
      <div className={styles.quotaHeader}>
        <span className={styles.quotaName}>{category.name}</span>
        <span className={`${styles.statusBadge} ${statusClass}`}>
          {STATUS_LABELS[category.status]}
        </span>
      </div>
      <div className={styles.quotaNumbers}>
        <span className={styles.quotaUsed}>{category.used.toLocaleString()}</span>
        <span className={styles.quotaSep}>/</span>
        <span className={styles.quotaLimit}>{category.limit.toLocaleString()}</span>
        <span className={styles.quotaUnit}>{category.unit}</span>
      </div>
      <div className={styles.track}>
        <div
          className={`${styles.fill} ${fillClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className={styles.resetInfo}>
        <Clock size={11} />
        <span>Resets: {category.reset}</span>
      </div>
    </div>
  )
}

export function QuotaSection() {
  const user = useCurrentUser()
  const { quotas, loading, error, fetchQuotas, resetQuotas } = useQuotaStore()

  useEffect(() => {
    fetchQuotas()
  }, [fetchQuotas])

  const isStaff = (user as any)?.isStaff === true

  async function handleReset() {
    try {
      await resetQuotas()
      toast.success('Quotas have been reset')
    } catch {
      toast.error('Failed to reset quotas')
    }
  }

  const categoryKeys = ['search', 'actions', 'messages', 'uploads', 'tokens'] as const

  return (
    <div className={styles.section}>
      <SectionCard title="Usage Quotas">
        <div className={styles.headerRow}>
          {quotas?.plan ? (
            <span className={`${styles.planBadge} ${(styles as any)[`plan${quotas.plan.charAt(0).toUpperCase() + quotas.plan.slice(1)}`] || styles.planFree}`}>
              {PLAN_LABELS[quotas.plan] || quotas.plan} Plan
            </span>
          ) : null}
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={fetchQuotas}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? undefined : undefined} />
            Refresh
          </button>
        </div>

        {error ? (
          <div className={styles.errorBanner}>
            <ShieldAlert size={14} style={{ display: 'inline', marginRight: 6 }} />
            {error}
          </div>
        ) : null}

        <div className={styles.quotaGrid}>
          {quotas
            ? categoryKeys.map((key) => (
                <QuotaCard key={key} category={quotas[key]} />
              ))
            : !loading && (
                <p style={{ color: 'var(--text-muted)', fontSize: 13, gridColumn: '1/-1' }}>
                  Loading quota data...
                </p>
              )}
        </div>

        {isStaff ? (
          <div className={styles.adminSection}>
            <div className={styles.adminTitle}>Admin Controls</div>
            <p className={styles.adminDesc}>
              As staff, you can reset your own quotas immediately instead of waiting
              for the window to roll over.
            </p>
            <button
              type="button"
              className={styles.refreshBtn}
              onClick={handleReset}
              disabled={loading}
            >
              <RefreshCw size={14} />
              Reset My Quotas Now
            </button>
          </div>
        ) : null}
      </SectionCard>
    </div>
  )
}
