import type { SignetNode, SignetEdge } from './types'
import { nodeColor, getConnections, edgeColor } from './utils'
import { SG } from './tokens'
import { KeyValue, TagRow } from './components/Primitives'
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

          {selected.tags?.length > 0 && (
            <div className={s.section}>
              <div className={s.sectionLabel}>TAGS</div>
              <TagRow tags={selected.tags} max={selected.tags.length} />
            </div>
          )}

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
