import { useState, useEffect } from 'react'
import type { SignetNode, SignetEdge } from './types'
import { nodeColor, getConnections, edgeColor, timeSeries } from './utils'
import { SG } from './tokens'
import { KeyValue, TagRow } from './components/Primitives'
import { Sparkline } from './components/Sparkline'
import { fetchTimeseries } from '@/api/signet'
import s from './SignetDetailPanel.module.css'

interface SignetDetailPanelProps {
  selected: SignetNode | null
  onClose: () => void
  onNavigate: (node: SignetNode) => void
  nodes: SignetNode[]
  edges: SignetEdge[]
}

export function SignetDetailPanel({ selected, onClose, onNavigate, nodes, edges }: SignetDetailPanelProps) {
  const findNodeById = (id: string) => nodes.find(n => n.id === id)
  const [series, setSeries] = useState<number[]>([])
  const [seriesLoaded, setSeriesLoaded] = useState(false)

  useEffect(() => {
    if (!selected) return
    const days = selected.type === 'account' ? 30 : 14
    fetchTimeseries(selected.id, days)
      .then(s => { setSeries(s); setSeriesLoaded(true) })
      .catch(() => setSeriesLoaded(false))
  }, [selected?.id])

  const getSeries = (): number[] => {
    if (seriesLoaded && series.length > 0) return series
    return selected ? timeSeries(selected, selected.type === 'account' ? 30 : 14) : []
  }
  return (
    <div className={`${s.panel} ${selected ? s.panelOpen : ''}`}>
      {selected && (
        <div className={s.inner}>
          <div className={s.header}>
            <span className={s.typeLabel}>{selected.type.toUpperCase()} PROFILE</span>
            <button className={s.close} onClick={onClose}>×</button>
          </div>

          <div className={s.identity}>
            <div className={s.name} style={{ color: nodeColor(selected) }}>
              {'handle' in selected ? selected.handle : selected.label}
            </div>
            <div className={s.meta}>
              {'platform' in selected ? selected.platform?.toUpperCase() : '—'} &nbsp;·&nbsp;
              {('tier' in selected ? selected.tier : 'status' in selected ? selected.status : 'velocity' in selected ? selected.velocity : '—')?.toUpperCase()}
            </div>
          </div>

          <div className={s.statGrid}>
            {selected.type === 'account' && (
              <>
                <KeyValue label="FOLLOWERS" value={selected.followers.toLocaleString()} />
                <KeyValue label="POSTS" value={selected.posts} />
                <KeyValue label="CONFIDENCE" value={`${Math.round((selected.confidence || 0) * 100)}%`}
                  color={selected.confidence > 0.75 ? SG.high : selected.confidence > 0.5 ? SG.med : SG.low} />
                <KeyValue label="EDGES" value={getConnections(selected.id, edges).length} />
              </>
            )}
            {selected.type === 'narrative' && (
              <>
                <KeyValue label="REACH" value={selected.reach.toLocaleString()} />
                <KeyValue label="STATUS" value={selected.status.toUpperCase()}
                  color={selected.status === 'active' ? SG.high : SG.med} />
                <KeyValue label="CONFIDENCE" value={`${Math.round((selected.confidence || 0) * 100)}%`} color={SG.high} />
                <KeyValue label="AMPLIFIERS" value={getConnections(selected.id, edges).filter((e: SignetEdge) => e.type === 'AMPLIFIES').length} />
              </>
            )}
            {selected.type === 'hashtag' && (
              <>
                <KeyValue label="VOLUME" value={selected.volume.toLocaleString()} />
                <KeyValue label="VELOCITY" value={selected.velocity.toUpperCase()}
                  color={selected.velocity === 'peak' ? SG.high : SG.med} />
              </>
            )}
          </div>

          <div className={s.section}>
            <div className={s.sectionLabel}>
              CADENCE · {selected.type === 'account' ? '30d' : '14d'}
            </div>
            <Sparkline data={getSeries()} color={nodeColor(selected)} height={42} lineWidth={1.4} />
          </div>

          {selected.tags?.length > 0 && (
            <div className={s.section}>
              <div className={s.sectionLabel}>TAGS</div>
              <TagRow tags={selected.tags} max={selected.tags.length} />
            </div>
          )}

          {selected.type === 'narrative' && 'themes' in selected && selected.themes?.length ? (
            <div className={s.section}>
              <div className={s.sectionLabel}>THEMES</div>
              <TagRow tags={selected.themes} max={selected.themes.length} />
            </div>
          ) : null}

          {selected.type === 'narrative' && 'entities' in selected && selected.entities?.length ? (
            <div className={s.section}>
              <div className={s.sectionLabel}>ENTITIES</div>
              <TagRow tags={selected.entities} max={selected.entities.length} />
            </div>
          ) : null}

          <div>
            <div className={s.sectionLabel}>
              CONNECTIONS ({getConnections(selected.id, edges).length})
            </div>
            <div className={s.connections}>
              {getConnections(selected.id, edges).map((edge, i) => {
                const otherId = edge.source === selected.id ? edge.target : edge.source
                const other = findNodeById(otherId)
                const dir = edge.source === selected.id ? '→' : '←'
                return (
                  <div key={i} className={s.connRow} onClick={() => other && onNavigate(other)}>
                    <div className={s.connEdge} style={{ background: edgeColor(edge) }} />
                    <span className={s.connName}>
                      {dir} {other ? ('handle' in other ? (other as { handle: string }).handle : other.label) : otherId}
                    </span>
                    <span className={s.connType}>{edge.type.split('_')[0]}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
