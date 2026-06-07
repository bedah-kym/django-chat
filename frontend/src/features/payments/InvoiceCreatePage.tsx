import { Link } from 'react-router-dom'
import styles from './PaymentPages.module.css'

export function InvoiceCreatePage() {
  return (
    <div className={styles.payments}>
      <Link to="/app/ops/wallet" className={styles.backLink}>Back to wallet</Link>
      <h2 className={styles.pageTitle}>Create Invoice</h2>
      <div className={styles.formCard}>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Recipient Name</span>
            <input className={styles.input} placeholder="e.g. John Doe" />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Recipient Email</span>
            <input className={styles.input} type="email" placeholder="e.g. john@example.com" />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Amount (KES)</span>
            <input className={styles.input} type="number" placeholder="50000" />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Due Date</span>
            <input className={styles.input} type="date" />
          </label>
        </div>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Description</span>
          <textarea className={styles.textarea} rows={3} placeholder="What is this invoice for?" />
        </label>
        <button className={styles.btnPrimary}>Create & Send Invoice</button>
      </div>
    </div>
  )
}
