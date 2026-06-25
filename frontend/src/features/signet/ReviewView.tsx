import { useState } from 'react'
import { toast } from 'sonner'
import { tierColor } from './utils'
import { SG } from './tokens'
import { SectionLabel, Panel, TagChip, KeyValue, ThreatMeter } from './components/Primitives'
import { decideReview } from '@/api/signet'
import type { ReviewItem } from './types'
import s from './ReviewView.module.css'

interface ReviewViewProps {
  reviews: ReviewItem[]
  reload?: () => Promise<void>
}

const DECISION_LABEL: Record<string, string> = {
  approved: 'Approved',
  rejected: 'Rejected',
  amended: 'Amended',
}

export function ReviewView({ reviews: REVIEW_QUEUE, reload }: ReviewViewProps) {
  const [decisions, setDecisions] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  const decide = async (item: ReviewItem, decision: 'approved' | 'rejected' | 'amended') => {
    setBusy(item.id)
    // Optimistic: drop from the queue immediately, roll back on failure.
    setDecisions(p => ({ ...p, [item.id]: decision }))
    try {
      const tags = decision === 'amended'
        ? [{ tag: item.verdict_tag, confidence: item.confidence, excerpt: item.excerpt }]
        : undefined
      await decideReview(Number(item.id), decision, tags)
      toast.success(`${DECISION_LABEL[decision]} · ${item.verdict_tag}`)
      await reload?.()
    } catch {
      setDecisions(p => { const n = { ...p }; delete n[item.id]; return n })
      toast.error('Decision failed — try again')
    } finally {
      setBusy(null)
    }
  }

  const pending = REVIEW_QUEUE.filter(r => !decisions[r.id])
  const avgConf = REVIEW_QUEUE.length
    ? Math.round((REVIEW_QUEUE.reduce((a, r) => a + (r.confidence || 0), 0) / REVIEW_QUEUE.length) * 100)
    : 0
  const stats = [
    { l: 'PENDING', v: pending.length, c: SG.med },
    { l: 'GATE 1 ITEMS', v: REVIEW_QUEUE.filter(r => r.gate === 'GATE 1').length, c: SG.live },
    { l: 'AVG LLM CONFIDENCE', v: REVIEW_QUEUE.length ? `${avgConf}%` : '—', c: SG.low },
    { l: 'GATE 2 ITEMS', v: REVIEW_QUEUE.filter(r => r.gate === 'GATE 2').length, c: SG.high },
  ]

  return (
    <div className={s.view}>
      <div className={s.header}>
        <div className={s.headTop}>
          <div className={s.titleWrap}>
            <SectionLabel>Human-in-the-loop</SectionLabel>
            <h2 className={s.title}>
              Review queue <span className={s.titleAccent}>· tag verdicts awaiting approval</span>
            </h2>
          </div>
          <div className={s.legend}>
            · GATE 1 routine 7-day window · GATE 2 sensitive 10-day window
          </div>
        </div>
        <div className={s.stats}>
          {stats.map(stat => (
            <KeyValue key={stat.l} label={stat.l} value={stat.v} color={stat.c} />
          ))}
        </div>
      </div>

      <div className={s.scroll}>
        {pending.length === 0 && <div className={s.empty}>✓ Queue clear — nice work</div>}
        <div className={s.cards}>
          {pending.map((item, i) => {
            const gate2 = item.gate === 'GATE 2'
            const color = tierColor(item.tier)
            return (
              <Panel
                key={item.id}
                reticle={gate2}
                className={`${s.card} ${gate2 ? s.cardGate2 : ''}`}
                style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }}
              >
                <div className={s.cardTop}>
                  <span className={`${s.gateBadge} ${gate2 ? s.gateBadgeHigh : ''}`}>
                    {item.gate}{gate2 && ' · SENSITIVE'}
                  </span>
                  <span className={s.flagged}>FLAGGED {item.flagged_at}</span>
                </div>

                <div>
                  <div className={s.fieldLabel}>LLM Verdict</div>
                  <div className={s.verdictRow}>
                    <TagChip tag={item.verdict_tag} />
                    <div className={s.verdictMeter}>
                      <ThreatMeter
                        value={item.confidence}
                        max={1}
                        color={color}
                        label={`${Math.round(item.confidence * 100)}%`}
                      />
                    </div>
                  </div>
                </div>

                <div className={s.target}>
                  <span className={s.inlineLabel}>Target</span>
                  {item.target}
                </div>

                <div>
                  <div className={s.fieldLabel}>Grounding excerpt</div>
                  <div className={s.excerpt} style={{ borderInlineStartColor: color }}>
                    &ldquo;{item.excerpt}&rdquo;
                  </div>
                </div>

                {item.subtags.length > 0 && (
                  <div>
                    <div className={s.fieldLabel}>Tagger evidence · every tag it fired</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {item.subtags.map((st, j) => (
                        <div
                          key={j}
                          style={{
                            display: 'flex', flexDirection: 'column', gap: 3,
                            paddingInlineStart: 9, borderInlineStart: `2px solid ${SG.line}`,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <TagChip tag={st.tag} />
                            <span style={{ fontSize: 11, color: SG.textLow, fontVariantNumeric: 'tabular-nums' }}>
                              {Math.round((st.confidence || 0) * 100)}%
                            </span>
                          </div>
                          {st.excerpt && (
                            <div style={{ fontSize: 12, color: SG.textMid, fontStyle: 'italic' }}>
                              &ldquo;{st.excerpt}&rdquo;
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(item.context.summary || item.context.themes.length > 0) && (
                  <div>
                    <div className={s.fieldLabel}>What the tagger read</div>
                    {item.context.summary && (
                      <div style={{ fontSize: 12, color: SG.textMid }}>{item.context.summary}</div>
                    )}
                    {item.context.themes.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                        {item.context.themes.map(t => (
                          <span
                            key={t}
                            style={{
                              fontSize: 10, padding: '1px 6px', borderRadius: 4,
                              background: SG.panelRaised, color: SG.textLow, border: `1px solid ${SG.line}`,
                            }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className={s.reason}>
                  <span className={s.inlineLabel}>Reason</span>
                  {item.reason}
                </div>

                <div className={s.model}>{item.model}</div>

                <div className={s.actions}>
                  <button className={s.btn} disabled={busy === item.id} onClick={() => decide(item, 'rejected')}>
                    Reject
                  </button>
                  <button className={`${s.btn} ${s.btnAmend}`} disabled={busy === item.id} onClick={() => decide(item, 'amended')}>
                    Amend
                  </button>
                  <button className={`${s.btn} ${s.btnApprove}`} disabled={busy === item.id} onClick={() => decide(item, 'approved')}>
                    {busy === item.id ? '…' : 'Approve'}
                  </button>
                </div>
              </Panel>
            )
          })}
        </div>
      </div>
    </div>
  )
}
