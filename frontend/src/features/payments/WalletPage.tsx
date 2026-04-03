import { Link } from 'react-router-dom'
import { mockWallet, mockTransactions, mockInvoices } from '@/mocks/payments'
import styles from './PaymentPages.module.css'

export function WalletPage() {
  return (
    <div className={styles.payments}>
      {/* Balance Card */}
      <div className={styles.balanceCard}>
        <div className={styles.balanceLabel}>Wallet Balance</div>
        <div className={styles.balanceAmount}>
          KES {mockWallet.balance.toLocaleString()}
        </div>
        <div className={styles.balanceActions}>
          <button className={styles.btnPrimary}>Deposit</button>
          <button className={styles.btnOutline}>Withdraw</button>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className={styles.sectionHeader}>
        <h2>Recent Transactions</h2>
      </div>
      <div className={styles.list}>
        {mockTransactions.map(tx => (
          <div key={tx.id} className={styles.txItem}>
            <div className={styles.txIcon}>
              {tx.type === 'deposit' ? '↓' : tx.type === 'withdrawal' ? '↑' : tx.type === 'payment' ? '→' : '↩'}
            </div>
            <div className={styles.txContent}>
              <div className={styles.txDesc}>{tx.description}</div>
              <div className={styles.txMeta}>{new Date(tx.createdAt).toLocaleDateString()} · {tx.reference}</div>
            </div>
            <div className={`${styles.txAmount} ${tx.amount > 0 ? styles.positive : styles.negative}`}>
              {tx.amount > 0 ? '+' : ''}{tx.currency} {Math.abs(tx.amount).toLocaleString()}
            </div>
            <span className={`${styles.statusBadge} ${styles[tx.status]}`}>{tx.status}</span>
          </div>
        ))}
      </div>

      {/* Invoices */}
      <div className={styles.sectionHeader}>
        <h2>Invoices</h2>
        <Link to="/app/invoices/new" className={styles.btnPrimary}>+ New Invoice</Link>
      </div>
      <div className={styles.list}>
        {mockInvoices.map(inv => (
          <Link key={inv.id} to={`/app/invoices/${inv.referenceId}`} className={styles.invoiceItem}>
            <div className={styles.invoiceInfo}>
              <div className={styles.invoiceRef}>{inv.referenceId}</div>
              <div className={styles.invoiceRecipient}>{inv.recipientName}</div>
            </div>
            <div className={styles.invoiceAmount}>{inv.currency} {inv.amount.toLocaleString()}</div>
            <span className={`${styles.statusBadge} ${styles[inv.status]}`}>{inv.status}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
