import type { ActivityItem } from './types'
import { SectionLabel, Panel } from './components/Primitives'
import s from './ActivityFeed.module.css'

interface ActivityFeedProps {
  activity: ActivityItem[]
}

export function ActivityFeed({ activity: ACTIVITY }: ActivityFeedProps) {
  return (
    <div className={s.strip}>
      <div className={s.header}>
        <SectionLabel>Activity Feed</SectionLabel>
      </div>
      <div className={s.track}>
        {ACTIVITY.map((item, i) => (
          <Panel
            key={i}
            variant={item.alert ? 'inset' : 'panel'}
            className={`${s.card} ${item.alert ? s.cardAlert : ''}`}
            style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }}
          >
            <div className={s.cardHead}>
              {item.alert && <span className={s.alertTag}>{String.fromCharCode(9888)} Alert</span>}
              <span className={s.time}>{item.time}</span>
            </div>
            <div className={`${s.text} ${item.alert ? s.textAlert : ''}`}>{item.text}</div>
          </Panel>
        ))}
      </div>
    </div>
  )
}
