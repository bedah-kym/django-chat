import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { domainConfigs, domainOrder, getRoomPath, domainStatusCopy } from '@/domains'
import { mockEngagements, mockFindings } from '@/mocks/pentest'
import { mockPrograms, mockReports } from '@/mocks/bugBounty'
import { mockWallet } from '@/mocks/payments'
import { useChatStore } from '@/stores/chatStore'
import styles from './HomePage.module.css'

export function HomePage() {
  const navigate = useNavigate()
  const rooms = useChatStore((s) => s.rooms)
  const recentWork = [
    {
      label: 'Security',
      title: `${mockFindings.length} findings queued`,
      detail: 'Active pentest workspaces and bug bounty drafts need review.',
      href: '/app/security',
    },
    {
      label: 'Business/Ops',
      title: `KES ${mockWallet.balance.toLocaleString()} wallet balance`,
      detail: 'Invoices, travel, and reminders are grouped under ops.',
      href: '/app/ops',
    },
    {
      label: 'Dev',
      title: `${rooms.filter((room) => room.domain === 'dev').length} dev rooms`,
      detail: 'Engineering spaces stay separate from security and ops.',
      href: '/app/dev',
    },
  ]

  return (
    <div className={styles.home}>
      <div className={styles.hero}>
        <div>
          <div className={styles.eyebrow}>Global Home</div>
          <h1 className={styles.title}>Work by domain, not by clutter.</h1>
          <p className={styles.description}>
            Enter a workspace to focus. Security, Social, Dev, and Business/Ops each keep their own rooms, navigation, and recent work.
          </p>
        </div>
      </div>

      <div className={styles.domainGrid}>
        {domainOrder.map((domainId, index) => {
          const domain = domainConfigs[domainId]
          const Icon = domain.icon
          const room = rooms.find((item) => item.domain === domainId)
          const shortcut = room ? getRoomPath(room) : domain.defaultRoute

          return (
            <motion.div
              key={domainId}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div
                className={styles.domainCard}
                role="button"
                tabIndex={0}
                onClick={() => navigate(domain.defaultRoute)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    navigate(domain.defaultRoute)
                  }
                }}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.cardIcon}><Icon size={18} /></div>
                  <span className={styles.cardLabel}>{domain.label}</span>
                </div>
                <p className={styles.cardDescription}>{domain.description}</p>
                <div className={styles.cardFooter}>
                  <span>{domainStatusCopy[domainId]}</span>
                  <Link to={shortcut} className={styles.shortcutLink} onClick={(event) => event.stopPropagation()}>
                    Open latest
                  </Link>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      <div className={styles.sections}>
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Recent Work</h2>
          </div>
          <div className={styles.activityList}>
            {recentWork.map((item) => (
              <Link key={item.label} to={item.href} className={styles.activityItem}>
                <div className={styles.activityLabel}>{item.label}</div>
                <div className={styles.activityTitle}>{item.title}</div>
                <div className={styles.activityDetail}>{item.detail}</div>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Key Alerts</h2>
          </div>
          <div className={styles.alertList}>
            <div className={styles.alertCard}>
              <span className={styles.alertLabel}>Security</span>
              <strong>{mockEngagements.filter((item) => item.status === 'running').length} active engagement</strong>
              <p>{mockFindings.filter((item) => item.severity === 'critical').length} critical findings currently open.</p>
            </div>
            <div className={styles.alertCard}>
              <span className={styles.alertLabel}>Bug Bounty</span>
              <strong>{mockPrograms.length} enrolled programs</strong>
              <p>{mockReports.filter((item) => item.status === 'draft').length} draft reports waiting for refinement.</p>
            </div>
            <div className={styles.alertCard}>
              <span className={styles.alertLabel}>Ops</span>
              <strong>KES {mockWallet.balance.toLocaleString()} available</strong>
              <p>Wallet and invoice workflows remain available inside Business/Ops.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
