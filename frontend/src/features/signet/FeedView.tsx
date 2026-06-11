import { useState } from 'react'
import { toast } from 'sonner'
import type { SignetNode } from './types'
import { threatScore, threatBand, nodeColor, timeSeries } from './utils'
import { SG } from './tokens'
import { SectionLabel, ThreatMeter, TagRow } from './components/Primitives'
import { Sparkline, Sparkbars } from './components/Sparkline'
import s from './FeedView.module.css'

interface FeedViewProps {
  search: string
  nodes: SignetNode[]
}

const TABS = [
  { key: 'account', label: 'Accounts', color: SG.low },
  { key: 'narrative', label: 'Narratives', color: SG.high },
  { key: 'hashtag', label: 'Hashtags', color: SG.med },
] as const

export function FeedView({ search, nodes: NODES }: FeedViewProps) {
  const [tab, setTab] = useState<string>('account')

  const searchLower = search.trim().toLowerCase()
  const rows = NODES.filter(n => n.type === tab)
    .filter(n => {
      if (!searchLower) return true
      const label = 'handle' in n ? n.handle : n.label
      const hay = (label + ' ' + (n.tags || []).join(' ')).toLowerCase()
      return hay.includes(searchLower)
    })
    .map(n => ({ ...n, score: threatScore(n) }))
    .sort((a, b) => b.score - a.score)

  const maxScore = Math.max(1, ...rows.map(r => r.score))

  return (
    <div className={s.view}>
      <div className={s.header}>
        <div className={s.titleWrap}>
          <SectionLabel>Operator triage</SectionLabel>
          <h2 className={s.title}>
            Feed <span className={s.titleAccent}>· ranked by threat score</span>
          </h2>
        </div>
        <div className={s.tabs}>
          {TABS.map(t => {
            const count = NODES.filter(n => n.type === t.key).length
            const active = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`${s.tab} ${active ? s.tabActive : ''}`}
              >
                <span className={s.tabDot} style={{ background: t.color }} />
                {t.label}
                <span className={s.tabCount}>{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className={s.colHead}>
        <div />
        <div>{tab === 'account' ? 'Handle' : tab === 'narrative' ? 'Narrative' : 'Hashtag'}</div>
        <div>Tier</div>
        <div>Threat</div>
        <div>Trend · 7d</div>
        <div>{tab === 'hashtag' ? 'Velocity' : 'Conf.'}</div>
        <div>Tags</div>
        <div className={s.colHeadRight}>Action</div>
      </div>

      <div className={s.rows}>
        {rows.length === 0 && <div className={s.empty}>No matches</div>}
        {rows.map((r, i) => {
          const band = threatBand(r.score)
          const conf =
            r.type === 'hashtag'
              ? 'velocity' in r
                ? r.velocity?.toUpperCase()
                : '—'
              : `${Math.round((('confidence' in r ? r.confidence : 0) || 0) * 100)}%`
          const tierVal = ('tier' in r ? r.tier : 'status' in r ? r.status : '—')?.toUpperCase()
          const name = 'handle' in r ? r.handle : r.label
          return (
            <div
              key={r.id}
              className={s.row}
              style={{ animationDelay: `${Math.min(i * 22, 400)}ms` }}
              onClick={() => toast(`Inspecting ${name}`, { description: `Threat ${r.score} · ${band.label}` })}
            >
              <div className={s.rail} style={{ background: band.color }} />
              <div className={s.handle} style={{ color: nodeColor(r as SignetNode) }}>
                {name}
              </div>
              <div className={s.tier}>{tierVal}</div>
              <ThreatMeter value={r.score} max={maxScore} color={band.color} />
              <div className={s.trend}>
                {r.type === 'account' ? (
                  <Sparkbars data={timeSeries(r as SignetNode, 7)} color={band.color} height={18} />
                ) : (
                  <Sparkline data={timeSeries(r as SignetNode, 7)} color={band.color} height={18} lineWidth={1.2} />
                )}
              </div>
              <div className={s.conf}>{conf}</div>
              <div className={s.tags}>
                <TagRow tags={r.tags} max={3} />
              </div>
              <div className={s.actions}>
                <button
                  className={s.btn}
                  onClick={e => {
                    e.stopPropagation()
                    toast(`Inspecting ${name}`)
                  }}
                >
                  Inspect
                </button>
                <button
                  className={`${s.btn} ${s.btnDanger}`}
                  onClick={e => {
                    e.stopPropagation()
                    toast.success(`Muted ${name}`, { description: 'Removed from active triage feed' })
                  }}
                >
                  Mute
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
