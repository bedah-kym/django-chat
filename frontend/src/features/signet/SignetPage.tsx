import { useState, useEffect } from 'react'
import type { SignetView, Filters, SignetNode, SignetEdge, ActivityItem, ReviewItem } from './types'
import { SignetTopBar } from './SignetTopBar'
import { SignetLeftNav } from './SignetLeftNav'
import { GraphView } from './GraphView'
import { FeedView } from './FeedView'
import { ReviewView } from './ReviewView'
import { ActivityFeed } from './ActivityFeed'
import { useSignetData } from './useSignetData'
import './signet.tokens.css'
import s from './SignetPage.module.css'

interface SignetPageProps {
  nodes?: SignetNode[]
  edges?: SignetEdge[]
  activity?: ActivityItem[]
  reviews?: ReviewItem[]
  initialView?: SignetView
}

export function SignetPage({ nodes: extNodes, edges: extEdges, activity: extActivity, reviews: extReviews, initialView = 'graph' }: SignetPageProps = {}) {
  const { nodes: apiNodes, edges: apiEdges, activity: apiActivity, reviews: apiReviews, reload } = useSignetData()

  const nodes = extNodes ?? apiNodes
  const edges = extEdges ?? apiEdges
  const activity = extActivity ?? apiActivity
  const reviews = extReviews ?? apiReviews

  const [view, setView] = useState<SignetView>(initialView)
  const [selected, setSelected] = useState<SignetNode | null>(null)
  const [filters, setFilters] = useState<Filters>({ account: true, narrative: true, hashtag: true })
  const [search, setSearch] = useState('')

  useEffect(() => { if (view !== 'graph') setSelected(null) }, [view])

  return (
    <div className={`console ${s.shell}`}>
      <div className="consoleTexture" />
      <div className="consoleScanlines" />
      <SignetTopBar view={view} search={search} setSearch={setSearch} nodes={nodes} edges={edges} />
      <div className={s.body}>
        <SignetLeftNav view={view} setView={setView} alertCount={reviews.filter(r => !('decision' in r) || (r as ReviewItem & { decision?: string }).decision === 'pending').length || 0} />
        <div className={s.stage}>
          {view === 'graph' && (
            <GraphView selected={selected} setSelected={setSelected}
              filters={filters} setFilters={setFilters} search={search}
              nodes={nodes} edges={edges} />
          )}
          {view === 'feed' && (
            <FeedView
              search={search}
              nodes={nodes}
              reload={reload}
              onInspect={(node) => { setSelected(node); setView('graph') }}
            />
          )}
          {view === 'review' && <ReviewView reviews={reviews} reload={reload} />}
        </div>
      </div>
      <ActivityFeed activity={activity} />
    </div>
  )
}
