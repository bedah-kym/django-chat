import { Link } from 'react-router-dom'
import { mockWallet, mockTransactions, mockInvoices } from '@/mocks/payments'
import styles from './PaymentPages.module.css'

export function WalletPage() {
  return (
    <div className={styles.payments}>
      {/* Editorial balance header — no card */}
      <div className={styles.balanceHeader}>
        <div className={styles.balanceLabel}>Wallet Balance</div>
        <div className={styles.balanceAmount}>
          <span className={styles.currency}>KES</span>
          <span className={styles.amount}>{mockWallet.balance.toLocaleString()}</span>
        </div>
        <div className={styles.balanceActions}>
          <button className={styles.btnPrimary}>Deposit</button>
          <button className={styles.btnOutline}>Withdraw</button>
        </div>
      </div>

      {/* Dense transactions */}
      <div className={styles.sectionHeader}>
        <h2>Recent Transactions</h2>
      </div>
      <div className={styles.denseList}>
        {mockTransactions.map(tx => (
          <div key={tx.id} className={styles.txRow}>
            <span className={styles.txType}>{tx.type}</span>
            <span className={styles.txDesc}>{tx.description}</span>
            <span className={styles.txRef}>{tx.reference}</span>
            <span className={`${styles.txAmount} ${tx.amount > 0 ? styles.positive : styles.negative}`}>
              {tx.amount > 0 ? '+' : ''}{Math.abs(tx.amount).toLocaleString()}
            </span>
            <span className={`${styles.statusBadge} ${styles[tx.status]}`}>{tx.status}</span>
          </div>
        ))}
      </div>

      {/* Invoices */}
      <div className={styles.sectionHeader}>
        <h2>Invoices</h2>
        <Link to="/app/ops/invoices/new" className={styles.btnPrimary}>+ New Invoice</Link>
      </div>
      <div className={styles.denseList}>
        {mockInvoices.map(inv => (
          <Link key={inv.id} to={`/app/ops/invoices/${inv.referenceId}`} className={styles.txRow}>
            <span className={styles.txRef}>{inv.referenceId}</span>
            <span className={styles.txDesc}>{inv.recipientName}</span>
            <span className={styles.txAmount}>{inv.amount.toLocaleString()}</span>
            <span className={`${styles.statusBadge} ${styles[inv.status]}`}>{inv.status}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
