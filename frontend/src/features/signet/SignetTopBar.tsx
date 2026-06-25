import type { SignetCollectionStatus } from '@/api/signet'
import type { SignetView, SignetNode, SignetEdge } from './types'
import { SignalDot } from './components/Primitives'
import s from './SignetTopBar.module.css'

interface SignetTopBarProps {
  view: SignetView
  search: string
  setSearch: (s: string) => void
  nodes?: SignetNode[]
  edges?: SignetEdge[]
  collectionStatus?: SignetCollectionStatus | null
  collectionBusy?: boolean
  alertCount?: number
  onStartCollection?: () => void
  onStopCollection?: () => void
}

export function SignetTopBar({
  view,
  search,
  setSearch,
  nodes = [],
  edges = [],
  collectionStatus,
  collectionBusy = false,
  alertCount = 0,
  onStartCollection,
  onStopCollection,
}: SignetTopBarProps) {
  const accounts = nodes.filter(n => n.type === 'account').length
  const narratives = nodes.filter(n => n.type === 'narrative').length
  const isCollecting = Boolean(collectionStatus?.is_collecting)
  const postsCollected = collectionStatus?.counts.posts_collected ?? 0
  const postsTagged = collectionStatus?.counts.posts_tagged ?? 0

  return (
    <div className={s.bar}>
      <div className={s.brand}>
        <span className={s.wordmark}>SIGNET</span>
        <div className={s.divider} />
        <span className={s.subtitle}>Social Intelligence Platform</span>
        <div className={s.divider} />
        <span className={s.viewLabel}>&middot; {view.toUpperCase()}</span>
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
              &times;
            </span>
          )}
        </div>
      </div>

      <div className={s.status}>
        <div className={s.live}>
          <SignalDot live={isCollecting} />
          <span className={isCollecting ? s.liveLabel : s.idleLabel}>
            {isCollecting ? 'Collecting' : 'Idle'}
          </span>
        </div>
        <button
          type="button"
          className={isCollecting ? s.stopButton : s.startButton}
          onClick={isCollecting ? onStopCollection : onStartCollection}
          disabled={collectionBusy}
        >
          {collectionBusy ? 'Syncing' : isCollecting ? 'Stop' : 'Start'}
        </button>
        <span className={s.counts}>
          <span className={s.countNum}>{postsCollected}</span> Posts
          <span className={s.countSep}>&middot;</span>
          <span className={s.countNum}>{postsTagged}</span> Tagged
          <span className={s.countSep}>&middot;</span>
          <span className={s.countNum}>{accounts}</span> Accounts
          <span className={s.countSep}>&middot;</span>
          <span className={s.countNum}>{narratives}</span> Narratives
          <span className={s.countSep}>&middot;</span>
          <span className={s.countNum}>{edges.length}</span> Edges
        </span>
        <div className={s.alert}>&#9888; {alertCount} Alerts</div>
      </div>
    </div>
  )
}
