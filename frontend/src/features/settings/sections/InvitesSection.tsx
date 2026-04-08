import { useState } from 'react'
import { toast } from 'sonner'
import type { PlatformInvite } from '@/types/user'
import { sendInvite } from '../settingsApi'
import { SectionCard } from '../components/SectionCard'
import styles from '../SettingsPage.module.css'

const MOCK_INVITES: PlatformInvite[] = [
  { email: 'grace@startup.co', status: 'activated', sentAt: '2026-02-10T10:00:00Z' },
  { email: 'brian@agency.co', status: 'pending', sentAt: '2026-03-15T14:00:00Z' },
]

const MAX_INVITES = 3

const STATUS_CLASS = {
  activated: styles.statusActivated,
  pending: styles.statusPending,
  expired: styles.statusExpired,
} as Record<PlatformInvite['status'], string>

export function InvitesSection() {
  const [invites, setInvites] = useState<PlatformInvite[]>(MOCK_INVITES)
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)

  const remaining = MAX_INVITES - invites.filter(i => i.status !== 'expired').length

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setSending(true)
    try {
      await sendInvite(email)
      setInvites(prev => [
        ...prev,
        { email, status: 'pending', sentAt: new Date().toISOString() },
      ])
      setEmail('')
      toast.success(`Invite sent to ${email}`)
    } catch {
      toast.error('Failed to send invite')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={styles.tabContent}>
      <SectionCard title="Platform Invites">
        <p className={styles.inviteNote}>
          You have <strong>{remaining}</strong> of {MAX_INVITES} invites remaining.
        </p>
        <form className={styles.inviteForm} onSubmit={handleSend}>
          <input
            className={styles.input}
            type="email"
            placeholder="colleague@company.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={remaining === 0}
            required
          />
          <button
            className={styles.btnPrimary}
            type="submit"
            disabled={sending || remaining === 0}
          >
            {sending ? 'Sending…' : 'Send Invite'}
          </button>
        </form>

        {invites.length > 0 && (
          <div className={styles.inviteTable}>
            <div className={styles.inviteTableHeader}>
              <span>Email</span>
              <span>Status</span>
              <span>Sent</span>
            </div>
            {invites.map((inv, i) => (
              <div key={i} className={styles.inviteTableRow}>
                <span className={styles.inviteEmail}>{inv.email}</span>
                <span className={`${styles.statusChip} ${STATUS_CLASS[inv.status]}`}>
                  {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                </span>
                <span className={styles.inviteDate}>
                  {new Date(inv.sentAt).toLocaleDateString('en-KE', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
