import { useEffect, useState } from 'react'
import type { ReportDraft } from '@/types/bugBounty'
import styles from './ReportDraftModal.module.css'

interface Props {
  draft: ReportDraft
  onClose: () => void
}

export function ReportDraftModal({ draft, onClose }: Props) {
  const [form, setForm] = useState(draft)

  useEffect(() => {
    setForm(draft)
  }, [draft])

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}>Report Draft Review</div>
          <button type="button" className={styles.close} onClick={onClose}>×</button>
        </div>

        <div className={styles.body}>
          <label className={styles.field}>
            <span>Title</span>
            <input className={styles.input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </label>

          <div className={styles.grid}>
            <label className={styles.field}>
              <span>Severity</span>
              <select className={styles.input} value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value as ReportDraft['severity'] })}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Med</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Platform</span>
              <input className={styles.input} value={form.platformProgram} onChange={e => setForm({ ...form, platformProgram: e.target.value })} />
            </label>
          </div>

          <label className={styles.field}>
            <span>Steps to Reproduce</span>
            <textarea className={styles.textarea} value={form.steps} onChange={e => setForm({ ...form, steps: e.target.value })} />
          </label>

          <label className={styles.field}>
            <span>Impact</span>
            <textarea className={styles.textarea} value={form.impact} onChange={e => setForm({ ...form, impact: e.target.value })} />
          </label>

          <div className={styles.evidenceRow}>
            <span className={styles.evidenceLabel}>Evidence</span>
            <div className={styles.evidenceChip}>{form.evidenceName}</div>
            <button type="button" className={styles.addFile}>+ Add file</button>
          </div>

          <div className={styles.estimate}>Estimated bounty: {form.estimatedBounty}</div>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.btnOutline} onClick={onClose}>Cancel</button>
          <button type="button" className={styles.btnPrimary}>Submit to H1</button>
        </div>
      </div>
    </div>
  )
}
