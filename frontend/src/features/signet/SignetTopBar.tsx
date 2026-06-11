import type { SignetView, SignetNode, SignetEdge } from './types'
import { SignalDot } from './components/Primitives'
import s from './SignetTopBar.module.css'

interface SignetTopBarProps {
  view: SignetView
  search: string
  setSearch: (s: string) => void
  nodes?: SignetNode[]
  edges?: SignetEdge[]
}

export function SignetTopBar({ view, search, setSearch, nodes = [], edges = [] }: SignetTopBarProps) {
  const accounts = nodes.filter(n => n.type === 'account').length
  const narratives = nodes.filter(n => n.type === 'narrative').length

  return (
    <div className={s.bar}>
      <div className={s.brand}>
        <span className={s.wordmark}>SIGNET</span>
        <div className={s.divider} />
        <span className={s.subtitle}>Social Intelligence Platform</span>
        <div className={s.divider} />
        <span className={s.viewLabel}>· {view.toUpperCase()}</span>
      </div>

      <div className={s.searchWrap}>
        <div className={s.search}>
          <span className={s.searchIcon}>{String.fromCharCode(0x2315)}</span>
          <input
            className={s.searchInput}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="search account, narrative, hashtag..."
          />
          {search && (
            <span className={s.searchClear} onClick={() => setSearch('')}>
              ×
            </span>
          )}
        </div>
      </div>

      <div className={s.status}>
        <div className={s.live}>
          <SignalDot live />
          <span className={s.liveLabel}>Collecting</span>
        </div>
        <span className={s.counts}>
          <span className={s.countNum}>{accounts}</span> Accounts
          <span className={s.countSep}>·</span>
          <span className={s.countNum}>{narratives}</span> Narratives
          <span className={s.countSep}>·</span>
          <span className={s.countNum}>{edges.length}</span> Edges
        </span>
        <div className={s.alert}>⚠ 2 Alerts</div>
      </div>
    </div>
  )
}
