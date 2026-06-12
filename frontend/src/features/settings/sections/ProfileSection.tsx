import { useState } from 'react'
import { toast } from 'sonner'
import type { UserProfile } from '@/types/user'
import { updateProfile } from '../settingsApi'
import { SectionCard } from '../components/SectionCard'
import { AvatarUpload } from '../components/AvatarUpload'
import styles from '../SettingsPage.module.css'

interface Props {
  user: UserProfile
}

const COMPANY_SIZES = [
  { value: '', label: 'Select size' },
  { value: '1-10', label: '1–10' },
  { value: '11-50', label: '11–50' },
  { value: '51-200', label: '51–200' },
  { value: '201-1000', label: '201–1000' },
  { value: '1000+', label: '1000+' },
]

export function ProfileSection({ user }: Props) {
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl)
  const displayParts = (user.displayName ?? '').trim().split(/\s+/).filter(Boolean)
  const [form, setForm] = useState({
    firstName: user.firstName ?? displayParts[0] ?? '',
    lastName: user.lastName ?? displayParts.slice(1).join(' '),
    bio: user.bio ?? '',
    location: user.location ?? '',
    website: user.website ?? '',
    role: user.role ?? '',
    industry: user.industry ?? '',
    companyName: user.companyName ?? '',
    companySize: user.companySize ?? '',
    twitterHandle: user.twitterHandle ?? '',
    linkedinUrl: user.linkedinUrl ?? '',
    githubUrl: user.githubUrl ?? '',
  })
  const [saving, setSaving] = useState(false)

  function set(key: keyof typeof form, val: string) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function save() {
    setSaving(true)
    try {
      await updateProfile({ ...form, avatarUrl })
      toast.success('Profile saved')
    } catch {
      toast.error('Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.tabContent}>
      {/* Avatar */}
      <AvatarUpload
        displayName={user.displayName ?? user.email ?? 'User'}
        avatarUrl={avatarUrl}
        onUploaded={setAvatarUrl}
      />

      {/* Basic Info */}
      <SectionCard title="Basic Info">
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>First Name</span>
            <input className={styles.input} value={form.firstName} onChange={e => set('firstName', e.target.value)} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Last Name</span>
            <input className={styles.input} value={form.lastName} onChange={e => set('lastName', e.target.value)} />
          </label>
          <label className={`${styles.field} ${styles.fieldFull}`}>
            <span className={styles.fieldLabel}>Email</span>
            <input className={styles.input} value={user.email ?? ''} readOnly type="email" />
          </label>
          <label className={`${styles.field} ${styles.fieldFull}`}>
            <span className={styles.fieldLabel}>Bio</span>
            <textarea
              className={`${styles.input} ${styles.textarea}`}
              value={form.bio}
              onChange={e => set('bio', e.target.value)}
              placeholder="Tell us a little about yourself"
              maxLength={500}
              rows={3}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Location</span>
            <input className={styles.input} value={form.location} onChange={e => set('location', e.target.value)} placeholder="Nairobi, Kenya" />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Website</span>
            <input className={styles.input} value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://" type="url" />
          </label>
        </div>
      </SectionCard>

      {/* Professional */}
      <SectionCard title="Professional">
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Role / Title</span>
            <input className={styles.input} value={form.role} onChange={e => set('role', e.target.value)} placeholder="Founder, Engineer, etc." />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Industry</span>
            <input className={styles.input} value={form.industry} onChange={e => set('industry', e.target.value)} placeholder="Technology, Finance, etc." />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Company Name</span>
            <input className={styles.input} value={form.companyName} onChange={e => set('companyName', e.target.value)} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Company Size</span>
            <select
              className={styles.input}
              value={form.companySize}
              onChange={e => set('companySize', e.target.value)}
            >
              {COMPANY_SIZES.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>
      </SectionCard>

      {/* Social Links */}
      <SectionCard title="Social Links">
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Twitter / X</span>
            <input className={styles.input} value={form.twitterHandle} onChange={e => set('twitterHandle', e.target.value)} placeholder="@handle" />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>LinkedIn</span>
            <input className={styles.input} value={form.linkedinUrl} onChange={e => set('linkedinUrl', e.target.value)} placeholder="linkedin.com/in/…" type="url" />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>GitHub</span>
            <input className={styles.input} value={form.githubUrl} onChange={e => set('githubUrl', e.target.value)} placeholder="github.com/…" type="url" />
          </label>
        </div>
      </SectionCard>

      <button className={styles.btnPrimary} onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save Profile'}
      </button>
    </div>
  )
}
