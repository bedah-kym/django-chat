import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, ReceiptText, WalletCards } from 'lucide-react'
import { usePaymentStore } from '@/stores/paymentStore'
import { formatCurrency } from '@/utils/format'
import { useDelayedFlag } from '@/hooks/useDelayedFlag'
import { WalletSkeleton } from '@/components/ui/WalletSkeleton'
import styles from './PaymentPages.module.css'

export function WalletPage() {
  const { wallet, transactions } = usePaymentStore()
  const isLoading = usePaymentStore((s) => s.isLoading)
  const initialize = usePaymentStore((s) => s.initialize)
  const showSkeleton = useDelayedFlag(isLoading && !wallet)

  useEffect(() => { initialize() }, [initialize])

  if (showSkeleton) return <WalletSkeleton />

  return (
    <div className={styles.workspacePage}>
      <section className={styles.workspaceHero}>
        <div className={styles.heroBlock}>
          <div className={styles.balanceLabel}>Available balance</div>
          <div className={styles.balanceAmount}>{formatCurrency(wallet?.balance ?? 0)}</div>
          <div className={styles.balanceMeta}>Operational funds available for invoices, payouts, and travel this cycle.</div>
        </div>
        <div className={styles.balanceActions}>
          <button className={styles.btnPrimary}><ArrowDownLeft size={15} />Deposit</button>
          <button className={styles.btnOutline}><ArrowUpRight size={15} />Withdraw</button>
        </div>
      </section>

      <div className={styles.workspaceGrid}>
        <section className={styles.workspacePanel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Recent transactions</h2>
              <p>Live money movement across the workspace.</p>
            </div>
            <span className={styles.panelIcon}><WalletCards size={16} /></span>
          </div>
          <div className={styles.workspaceList}>
            {transactions.map((tx) => (
              <div key={tx.id} className={styles.txRow}>
                <div className={styles.txLead}>
                  <span className={styles.txType}>{tx.type}</span>
                  <span className={styles.txDesc}>{tx.description}</span>
                </div>
                <span className={styles.txRef}>{tx.reference}</span>
                <span className={`${styles.txAmount} ${tx.amount > 0 ? styles.positive : styles.negative}`}>
                  {tx.amount > 0 ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                </span>
                <span className={`${styles.statusBadge} ${styles[tx.status]}`}>{tx.status}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.workspacePanel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Invoices</h2>
              <p>Outbound billing in the current workspace.</p>
            </div>
            <Link to="/app/ops/invoices/new" className={styles.btnPrimary}>
              <ReceiptText size={15} />
              New Invoice
            </Link>
          </div>
          <div className={styles.workspaceList}>
            {([] as import('@/types/payments').Invoice[]).map((inv) => (
              <Link key={inv.id} to={`/app/ops/invoices/${inv.referenceId}`} className={styles.txRow}>
                <div className={styles.txLead}>
                  <span className={styles.txRef}>{inv.referenceId}</span>
                  <span className={styles.txDesc}>{inv.recipientName}</span>
                </div>
                <span className={styles.txAmount}>{formatCurrency(inv.amount, inv.currency)}</span>
                <span className={`${styles.statusBadge} ${styles[inv.status]}`}>{inv.status}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
