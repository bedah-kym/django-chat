import { useState } from 'react'
import { tierColor } from './utils'
import { SG } from './tokens'
import { SectionLabel, Panel, TagChip, KeyValue, ThreatMeter } from './components/Primitives'
import type { ReviewItem } from './types'
import s from './ReviewView.module.css'

interface ReviewViewProps {
  reviews: ReviewItem[]
}

export function ReviewView({ reviews: REVIEW_QUEUE }: ReviewViewProps) {
  const [decisions, setDecisions] = useState<Record<string, string>>({})
  const decide = (id: string, choice: string) => setDecisions(p => ({ ...p, [id]: choice }))

  const pending = REVIEW_QUEUE.filter(r => !decisions[r.id])
  const reviewedToday = 47
  const stats = [
    { l: 'PENDING', v: pending.length, c: SG.med },
    { l: 'REVIEWED TODAY', v: reviewedToday, c: SG.live },
    { l: 'AVG LLM CONFIDENCE', v: '64%', c: SG.low },
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

                <div className={s.reason}>
                  <span className={s.inlineLabel}>Reason</span>
                  {item.reason}
                </div>

                <div className={s.model}>{item.model}</div>

                <div className={s.actions}>
                  <button className={s.btn} onClick={() => decide(item.id, 'reject')}>
                    Reject
                  </button>
                  <button className={`${s.btn} ${s.btnAmend}`} onClick={() => decide(item.id, 'amend')}>
                    Amend
                  </button>
                  <button className={`${s.btn} ${s.btnApprove}`} onClick={() => decide(item.id, 'approve')}>
                    Approve
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
