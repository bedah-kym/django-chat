import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { startCollection, stopCollection, type SignetCollectionPlatform } from '@/api/signet'
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
  const {
    nodes: apiNodes,
    edges: apiEdges,
    activity: apiActivity,
    reviews: apiReviews,
    collectionStatus,
    reload,
  } = useSignetData()

  const nodes = extNodes ?? apiNodes
  const edges = extEdges ?? apiEdges
  const activity = extActivity ?? apiActivity
  const reviews = extReviews ?? apiReviews

  const [view, setView] = useState<SignetView>(initialView)
  const [selected, setSelected] = useState<SignetNode | null>(null)
  const [filters, setFilters] = useState<Filters>({ account: true, narrative: true, hashtag: true })
  const [search, setSearch] = useState('')
  const [collectionBusy, setCollectionBusy] = useState(false)
  const [collectionPlatform, setCollectionPlatform] = useState<SignetCollectionPlatform>('reddit')
  const pendingReviewCount = reviews.filter(
    r => !('decision' in r) || (r as ReviewItem & { decision?: string }).decision === 'pending',
  ).length || 0

  useEffect(() => { if (view !== 'graph') setSelected(null) }, [view])

  const handleStartCollection = async () => {
    setCollectionBusy(true)
    try {
      await startCollection(collectionPlatform)
      await reload()
      toast.success(`SIGNET ${collectionPlatform} collection started`)
    } catch (err) {
      console.error('Failed to start SIGNET collection', err)
      toast.error(err instanceof Error ? err.message : 'Failed to start SIGNET collection')
    } finally {
      setCollectionBusy(false)
    }
  }

  const handleStopCollection = async () => {
    setCollectionBusy(true)
    try {
      await stopCollection(collectionStatus?.session_id)
      await reload()
      toast.success('SIGNET collection stopped')
    } catch (err) {
      console.error('Failed to stop SIGNET collection', err)
      toast.error(err instanceof Error ? err.message : 'Failed to stop SIGNET collection')
    } finally {
      setCollectionBusy(false)
    }
  }

  return (
    <div className={`console ${s.shell}`}>
      <div className="consoleTexture" />
      <div className="consoleScanlines" />
      <SignetTopBar
        view={view}
        search={search}
        setSearch={setSearch}
        nodes={nodes}
        edges={edges}
        collectionStatus={collectionStatus}
        collectionBusy={collectionBusy}
        collectionPlatform={collectionPlatform}
        alertCount={pendingReviewCount}
        onCollectionPlatformChange={setCollectionPlatform}
        onStartCollection={handleStartCollection}
        onStopCollection={handleStopCollection}
      />
      <div className={s.body}>
        <SignetLeftNav view={view} setView={setView} alertCount={pendingReviewCount} />
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
