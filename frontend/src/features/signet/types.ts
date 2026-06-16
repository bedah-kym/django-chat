export interface AccountNode {
  id: string
  type: 'account'
  handle: string
  tier: 'macro' | 'mid' | 'micro'
  tags: string[]
  followers: number
  posts: number
  confidence: number
  platform: string
}

export interface NarrativeNode {
  id: string
  type: 'narrative'
  label: string
  tags: string[]
  reach: number
  confidence: number
  status: 'active' | 'decaying'
  themes?: string[]
  entities?: string[]
}

export interface HashtagNode {
  id: string
  type: 'hashtag'
  label: string
  volume: number
  velocity: 'low' | 'medium' | 'high' | 'peak'
  tags: string[]
}

export type SignetNode = AccountNode | NarrativeNode | HashtagNode

export interface SignetEdge {
  source: string
  target: string
  type: 'SEEDS' | 'AMPLIFIES' | 'TAGGED_WITH' | 'SPREADS_VIA' | 'PART_OF_NETWORK'
}

export interface ActivityItem {
  time: string
  alert: boolean
  text: string
}

export interface ReviewItem {
  id: string
  gate: string
  verdict_tag: string
  target: string
  confidence: number
  tier: string
  excerpt: string
  reason: string
  flagged_at: string
  model: string
}

export type SignetView = 'graph' | 'feed' | 'review'

export type FilterKey = 'account' | 'narrative' | 'hashtag'

export type Filters = Record<FilterKey, boolean>
