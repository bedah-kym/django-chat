import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import type { SignetNode } from './types'
import { threatScore, threatBand, nodeColor, timeSeries } from './utils'
import { SG } from './tokens'
import { SectionLabel, ThreatMeter, TagRow } from './components/Primitives'
import { Sparkline, Sparkbars } from './components/Sparkline'
import { muteAccount, fetchTimeseriesBulk } from '@/api/signet'
import s from './FeedView.module.css'

interface FeedViewProps {
  search: string
  nodes: SignetNode[]
  reload?: () => Promise<void>
  onInspect?: (node: SignetNode) => void
}

// Node ids are `acc_<pk>` / `nar_<pk>` / `tag_<pk>` — pull the numeric pk.
function nodePk(id: string): number {
  return Number(id.split('_')[1])
}

const TABS = [
  { key: 'account', label: 'Accounts', color: SG.low },
  { key: 'narrative', label: 'Narratives', color: SG.high },
  { key: 'hashtag', label: 'Hashtags', color: SG.med },
] as const

export function FeedView({ search, nodes: NODES, reload, onInspect }: FeedViewProps) {
  const [tab, setTab] = useState<string>('account')
  const [muting, setMuting] = useState<string | null>(null)
  const [tsMap, setTsMap] = useState<Record<string, number[]> | null>(null)

  useEffect(() => {
    fetchTimeseriesBulk(7).then(setTsMap).catch(() => setTsMap(null))
  }, [])

  const getSeries = (node: SignetNode): number[] => {
    const series = tsMap?.[node.id]
    return series ?? timeSeries(node, 7)
  }

  const handleMute = async (node: SignetNode, name: string) => {
    if (node.type !== 'account') return
    setMuting(node.id)
    try {
      await muteAccount(nodePk(node.id))
      toast.success(`Muted ${name}`, { description: 'Removed from active triage feed' })
      await reload?.()
    } catch {
      toast.error(`Couldn't mute ${name}`)
    } finally {
      setMuting(null)
    }
  }

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
              onClick={() => onInspect?.(r as SignetNode)}
            >
              <div className={s.rail} style={{ background: band.color }} />
              <div className={s.handle} style={{ color: nodeColor(r as SignetNode) }}>
                {name}
              </div>
              <div className={s.tier}>{tierVal}</div>
              <ThreatMeter value={r.score} max={maxScore} color={band.color} />
              <div className={s.trend}>
                {r.type === 'account' ? (
                  <Sparkbars data={getSeries(r as SignetNode)} color={band.color} height={18} />
                ) : (
                  <Sparkline data={getSeries(r as SignetNode)} color={band.color} height={18} lineWidth={1.2} />
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
                    onInspect?.(r as SignetNode)
                  }}
                >
                  Inspect
                </button>
                {r.type === 'account' && (
                  <button
                    className={`${s.btn} ${s.btnDanger}`}
                    disabled={muting === r.id}
                    onClick={e => {
                      e.stopPropagation()
                      handleMute(r as SignetNode, name)
                    }}
                  >
                    {muting === r.id ? 'Muting…' : 'Mute'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
