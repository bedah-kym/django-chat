import { Link, useParams } from 'react-router-dom'
import { mockInvoices } from '@/mocks/payments'
import { formatCurrency, formatDate } from '@/utils/format'
import styles from './PaymentPages.module.css'

export function InvoiceDetailPage() {
  const { ref } = useParams<{ ref: string }>()
  const invoice = mockInvoices.find((item) => item.referenceId === ref)

  if (!invoice) return <div>Invoice not found</div>

  return (
    <div className={styles.payments}>
      <Link to="/app/ops/wallet" className={styles.backLink}>Back to wallet</Link>
      <div className={styles.invoiceDetail}>
        <div className={styles.invoiceDetailHeader}>
          <div>
            <h2 className={styles.pageTitle}>{invoice.referenceId}</h2>
            <p className={styles.detailMeta}>Created {formatDate(invoice.createdAt, { dateStyle: 'medium' })}</p>
          </div>
          <span className={`${styles.statusBadge} ${styles[invoice.status]}`}>{invoice.status}</span>
        </div>
        <div className={styles.detailGrid}>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Recipient</span>
            <span>{invoice.recipientName}</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Email</span>
            <span>{invoice.recipientEmail}</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Amount</span>
            <span className={styles.detailAmount}>{formatCurrency(invoice.amount, invoice.currency)}</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Due Date</span>
            <span>{formatDate(invoice.dueDate, { dateStyle: 'medium' })}</span>
          </div>
        </div>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>Description</span>
          <p>{invoice.description}</p>
        </div>
      </div>
    </div>
  )
}
