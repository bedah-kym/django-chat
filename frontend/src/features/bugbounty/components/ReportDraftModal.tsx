import { useEffect, useState } from 'react'
import type { ReportDraft } from '@/types/bugBounty'
import { useBugBountyStore } from '@/stores/bugbountyStore'
import { importFindingToHackerone } from '@/api/bugbounty'
import styles from './ReportDraftModal.module.css'

interface Props {
  draft: ReportDraft
  onClose: () => void
}

export function ReportDraftModal({ draft, onClose }: Props) {
  const [form, setForm] = useState(draft)
  const programs = useBugBountyStore((s) => s.programs)
  const refresh = useBugBountyStore((s) => s.refresh)
  const [programHandle, setProgramHandle] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitResult, setSubmitResult] = useState<{ report_id: string; url: string | null } | null>(null)

  const hackerOnePrograms = programs.filter(p => p.platform === 'HackerOne' && p.sourceHandle)

  useEffect(() => {
    setForm(draft)
    const h1 = programs.filter(p => p.platform === 'HackerOne' && p.sourceHandle)
    const match = h1.find(p => p.name === draft.platformProgram) || h1[0]
    setProgramHandle(match?.sourceHandle || '')
  }, [draft, programs])

  const handleSubmit = async () => {
    if (!programHandle) {
      setSubmitError('Select a HackerOne program to import into.')
      return
    }
    setIsSubmitting(true)
    setSubmitError(null)
    setSubmitResult(null)
    try {
      const result = await importFindingToHackerone({
        program_handle: programHandle,
        title: form.title,
        vulnerability_information: form.steps,
        impact: form.impact,
        severity: form.severity,
      })
      setSubmitResult(result)
      // Refresh the reports list so the imported report appears immediately.
      await refresh()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setIsSubmitting(false)
    }
  }

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
              <span>HackerOne Program</span>
              {hackerOnePrograms.length > 0 ? (
                <select className={styles.input} value={programHandle} onChange={e => setProgramHandle(e.target.value)}>
                  <option value="">Select program…</option>
                  {hackerOnePrograms.map(p => (
                    <option key={p.id} value={p.sourceHandle}>{p.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  className={styles.input}
                  placeholder="Program handle (e.g. security)"
                  value={programHandle}
                  onChange={e => setProgramHandle(e.target.value)}
                />
              )}
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

          {submitResult && (
            <div className={styles.importSuccess}>
              Imported as report{' '}
              <a href={submitResult.url || undefined} target="_blank" rel="noreferrer">
                {submitResult.report_id}
              </a>
            </div>
          )}
          {submitError && <div className={styles.importError}>{submitError}</div>}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.btnOutline} onClick={onClose}>Cancel</button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleSubmit}
            disabled={isSubmitting || !programHandle}
          >
            {isSubmitting ? 'Submitting…' : 'Submit to H1'}
          </button>
        </div>
      </div>
    </div>
  )
}
