import type { PipelineStep } from '@/api/signet'
import s from './XPipeline.module.css'

const LABELS: Record<string, string> = {
  start: 'Starting',
  cookies: 'Loading cookies',
  auth: 'Authenticating',
  for_you: 'For You feed',
  following: 'Following feed',
  done: 'Complete',
}

function icon(status: string): string {
  if (status === 'running') return '\u23F3'  // hourglass
  if (status === 'ok') return '\u2705'        // checkmark
  if (status === 'fail') return '\u274C'       // cross
  return '\u25CB'                               // empty circle
}

interface Props {
  steps: PipelineStep[]
  visible: boolean
  onToggle: () => void
}

export function XPipeline({ steps, visible, onToggle }: Props) {
  if (!visible) {
    return (
      <button className={s.toggle} onClick={onToggle} title="X Pipeline">
        {steps.length > 0 && steps.some(s => s.status === 'fail') ? '\u{1F6A7}' : '\u{1F4E1}'}
      </button>
    )
  }

  return (
    <div className={s.panel}>
      <div className={s.header}>
        <span className={s.title}>X Pipeline</span>
        <button className={s.close} onClick={onToggle}>&times;</button>
      </div>
      <div className={s.steps}>
        {steps.length === 0 && (
          <div className={s.empty}>No pipeline data yet. Start X collection.</div>
        )}
        {steps.map((step, i) => (
          <div key={i} className={`${s.step} ${s[step.status]}`}>
            <span className={s.icon}>{icon(step.status)}</span>
            <span className={s.label}>{LABELS[step.name] || step.name}</span>
            {step.detail && <span className={s.detail}>{step.detail}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
