import { useState } from 'react'
import { toast } from 'sonner'
import type { WorkspaceInfo } from '@/types/user'
import { updateWorkspace } from '../settingsApi'
import { SectionCard } from '../components/SectionCard'
import styles from '../SettingsPage.module.css'

const MOCK_WORKSPACE: WorkspaceInfo = {
  name: 'TechVentures Ltd',
  plan: 'trial',
  accountType: 'business',
  trialActive: true,
  trialEndsAt: '2026-05-01T00:00:00Z',
}

const PLAN_LABELS: Record<WorkspaceInfo['plan'], string> = {
  free: 'Free',
  trial: 'Trial',
  pro: 'Pro',
  agency: 'Agency',
}

const PLAN_COLORS = {
  free: styles.planFree,
  trial: styles.planTrial,
  pro: styles.planPro,
  agency: styles.planAgency,
} as Record<WorkspaceInfo['plan'], string>

export function WorkspaceSection() {
  const [workspace, setWorkspace] = useState<WorkspaceInfo>(MOCK_WORKSPACE)
  const [name, setName] = useState(MOCK_WORKSPACE.name)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await updateWorkspace({ name })
      setWorkspace(prev => ({ ...prev, name }))
      toast.success('Workspace updated')
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.tabContent}>
      <SectionCard title="Workspace">
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Workspace Name</span>
          <input
            className={styles.input}
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </label>
        <div className={styles.workspaceMeta}>
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>Plan</span>
            <span className={`${styles.planBadge} ${PLAN_COLORS[workspace.plan]}`}>
              {PLAN_LABELS[workspace.plan]}
            </span>
          </div>
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>Account Type</span>
            <span className={styles.metaValue}>
              {workspace.accountType.charAt(0).toUpperCase() + workspace.accountType.slice(1)}
            </span>
          </div>
          {workspace.trialActive && workspace.trialEndsAt && (
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Trial ends</span>
              <span className={styles.metaValue}>
                {new Date(workspace.trialEndsAt).toLocaleDateString('en-KE', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
          )}
        </div>
        <button className={styles.btnPrimary} onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </SectionCard>
    </div>
  )
}
