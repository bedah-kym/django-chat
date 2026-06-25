import { apiRequest } from '@/api/client'
import type { SignetNode, SignetEdge, ActivityItem, ReviewItem } from '@/features/signet/types'

interface AccountResponse {
  id: number
  type: 'account'
  handle: string
  platform: string
  tier: string
  followers: number
  posts: number
  confidence: number
  tags: string[]
  is_muted: boolean
}

interface NarrativeResponse {
  id: number
  type: 'narrative'
  label: string
  tags: string[]
  reach: number
  confidence: number
  status: string
  themes?: string[]
  entities?: string[]
}

interface HashtagResponse {
  id: number
  type: 'hashtag'
  label: string
  volume: number
  velocity: string
  tags: string[]
}

interface EdgeResponse {
  id: number
  source_type: string
  source_id: number
  target_type: string
  target_id: number
  edge_type: string
}

interface ActivityResponse {
  id: number
  time: string
  alert: boolean
  text: string
}

interface ReviewResponse {
  id: number
  gate: string
  verdict_tag: string
  target: string
  confidence: number
  tier: string
  excerpt: string
  reason: string
  flagged_at: string
  model_name: string
  decision: string
  subtags: Array<{ tag: string; confidence: number; excerpt: string }>
  context: {
    themes: string[]
    entities: string[]
    summary: string
    novelty_note: string
    safety_category: string
  }
}

export interface SignetCollectionStatus {
  is_collecting: boolean
  session_id: number | null
  counts: {
    posts_collected: number
    posts_tagged: number
    accounts: number
  }
}

function nodeId(type: string, pk: number): string {
  const prefix = type === 'account' ? 'acc' : type === 'narrative' ? 'nar' : 'tag'
  return `${prefix}_${pk}`
}

export async function fetchAllSignetData(): Promise<{
  accounts: SignetNode[]
  narratives: SignetNode[]
  hashtags: SignetNode[]
  edges: SignetEdge[]
  activity: ActivityItem[]
  reviews: ReviewItem[]
}> {
  const [accounts, narratives, hashtags, edges, activity, reviews] = await Promise.all([
    apiRequest<AccountResponse[]>('/signet/accounts/'),
    apiRequest<NarrativeResponse[]>('/signet/narratives/'),
    apiRequest<HashtagResponse[]>('/signet/hashtags/'),
    apiRequest<EdgeResponse[]>('/signet/edges/'),
    apiRequest<ActivityResponse[]>('/signet/activity/'),
    apiRequest<ReviewResponse[]>('/signet/reviews/'),
  ])

  const accountNodes: SignetNode[] = accounts.map(a => ({
    id: nodeId('account', a.id),
    type: 'account' as const,
    handle: a.handle,
    platform: a.platform,
    tier: a.tier as 'macro' | 'mid' | 'micro',
    followers: a.followers,
    posts: a.posts,
    confidence: a.confidence,
    tags: a.tags || [],
  }))

  const narrativeNodes: SignetNode[] = narratives.map(n => ({
    id: nodeId('narrative', n.id),
    type: 'narrative' as const,
    label: n.label,
    tags: n.tags || [],
    reach: n.reach,
    confidence: n.confidence,
    status: n.status as 'active' | 'decaying',
    themes: n.themes as string[] | undefined,
    entities: n.entities as string[] | undefined,
  }))

  const hashtagNodes: SignetNode[] = hashtags.map(h => ({
    id: nodeId('hashtag', h.id),
    type: 'hashtag' as const,
    label: h.label,
    volume: h.volume,
    velocity: h.velocity as 'low' | 'medium' | 'high' | 'peak',
    tags: h.tags || [],
  }))

  const mappedEdges: SignetEdge[] = edges.map(e => ({
    source: nodeId(e.source_type, e.source_id),
    target: nodeId(e.target_type, e.target_id),
    type: e.edge_type as SignetEdge['type'],
  }))

  const mappedActivity: ActivityItem[] = activity.map(a => ({
    time: a.time,
    alert: a.alert,
    text: a.text,
  }))

  const mappedReviews: ReviewItem[] = reviews.map(r => ({
    id: String(r.id),
    gate: r.gate,
    verdict_tag: r.verdict_tag,
    target: r.target,
    confidence: r.confidence,
    tier: r.tier,
    excerpt: r.excerpt,
    reason: r.reason,
    flagged_at: r.flagged_at,
    model: r.model_name,
    subtags: r.subtags || [],
    context: r.context || { themes: [], entities: [], summary: '', novelty_note: '', safety_category: 'none' },
  }))

  return {
    accounts: [...accountNodes, ...narrativeNodes, ...hashtagNodes],
    narratives: narrativeNodes,
    hashtags: hashtagNodes,
    edges: mappedEdges,
    activity: mappedActivity,
    reviews: mappedReviews,
  }
}

export async function decideReview(
  reviewId: number,
  decision: 'approved' | 'rejected' | 'amended',
  tags?: Array<{ tag: string; confidence: number; excerpt: string }>,
) {
  return apiRequest(`/signet/reviews/${reviewId}/decide/`, {
    method: 'POST',
    body: JSON.stringify(tags ? { decision, tags } : { decision }),
  })
}

export async function muteAccount(accountId: number) {
  return apiRequest(`/signet/accounts/${accountId}/mute/`, {
    method: 'POST',
  })
}

export async function fetchCollectionStatus(): Promise<SignetCollectionStatus> {
  return apiRequest<SignetCollectionStatus>('/signet/collection/status/')
}

export async function startCollection() {
  return apiRequest<{ status: string; session_id: number }>('/signet/collection/start/', {
    method: 'POST',
    body: JSON.stringify({ subreddits: ['Kenya'], limit: 25 }),
  })
}

export async function stopCollection(sessionId?: number | null) {
  return apiRequest<{ status: string; session_id?: number }>('/signet/collection/stop/', {
    method: 'POST',
    body: JSON.stringify(sessionId ? { session_id: sessionId } : {}),
  })
}

export async function fetchTimeseries(nodeId: string, days: number): Promise<number[]> {
  const res = await apiRequest<{ series: number[] }>(`/signet/${nodeId}/timeseries/?days=${days}`)
  return res.series
}

export async function fetchTimeseriesBulk(days: number): Promise<Record<string, number[]>> {
  return apiRequest<Record<string, number[]>>(`/signet/timeseries/?days=${days}`)
}
