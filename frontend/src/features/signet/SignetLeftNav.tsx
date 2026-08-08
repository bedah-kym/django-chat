import type { SignetView } from './types'
import s from './SignetLeftNav.module.css'

const GraphIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="12" cy="18" r="2.5" />
    <line x1="6" y1="6" x2="12" y2="18" /><line x1="18" y1="6" x2="12" y2="18" /><line x1="6" y1="6" x2="18" y2="6" />
  </svg>
)

const FeedIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="14" y2="18" />
  </svg>
)

const ReviewIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="5" y="4" width="14" height="17" rx="1" />
    <path d="M9 12 l2 2 l4 -4" />
  </svg>
)

interface SignetLeftNavProps {
  view: SignetView
  setView: (v: SignetView) => void
  alertCount: number
}

export function SignetLeftNav({ view, setView, alertCount }: SignetLeftNavProps) {
  const items = [
    { key: 'graph' as SignetView, label: 'GRAPH', Icon: GraphIcon },
    { key: 'feed' as SignetView, label: 'FEED', Icon: FeedIcon },
    { key: 'review' as SignetView, label: 'REVIEW', Icon: ReviewIcon, badge: alertCount },
  ]

  return (
    <div className={s.rail}>
      {items.map(it => {
        const active = view === it.key
        return (
          <div
            key={it.key}
            onClick={() => setView(it.key)}
            title={it.label}
            className={`${s.item} ${active ? s.itemActive : ''}`}
          >
            <it.Icon />
            {it.badge != null && it.badge > 0 && <div className={s.badge}>{it.badge}</div>}
          </div>
        )
      })}
    </div>
  )
}
