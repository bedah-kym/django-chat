import type { SignetNode, SignetEdge } from './types'
import { SG, edgeColorToken } from './tokens'

const HIGH_THREAT_TAGS = new Set(['coordinated_inauthentic', 'firehose_falsehood', 'red_pill_pipeline'])

export function nodeColor(n: SignetNode): string {
  if (n.type === 'hashtag') return n.velocity === 'peak' ? SG.signal : '#b4781f'
  if (n.type === 'narrative') return n.status === 'active' ? SG.high : '#7a4a2a'
  if (n.tags?.some(t => HIGH_THREAT_TAGS.has(t))) return SG.high
  if (n.tags?.length > 0) return SG.signal
  return SG.low
}

export function nodeRadius(n: SignetNode): number {
  if (n.type === 'hashtag') return 7
  if (n.type === 'narrative') return 15
  if (n.tier === 'macro') return 22
  if (n.tier === 'mid') return 14
  return 8
}

export function edgeColor(e: SignetEdge): string {
  return edgeColorToken(e.type)
}

export function getConnections(nodeId: string, edges: SignetEdge[]): SignetEdge[] {
  return edges.filter(e => e.source === nodeId || e.target === nodeId)
}

export function threatScore(n: SignetNode): number {
  if (n.type === 'narrative') {
    const status = n.status === 'active' ? 1.5 : 0.5
    return Math.round(n.confidence * (n.reach / 1000) * status)
  }
  if (n.type === 'account') {
    // Real-signal threat (0-100): tag severity is the dominant axis (no follower
    // data is collected), modulated by confidence and reach. `followers` now holds
    // an engagement-based reach proxy set by the projector.
    const high = n.tags?.some(t => HIGH_THREAT_TAGS.has(t))
    const tagWeight = high ? 1 : (n.tags?.length ? 0.5 : 0.12)
    const reachNorm = Math.min(1, Math.log10((n.followers || 0) + (n.posts || 0) + 1) / 4)
    return Math.round(100 * tagWeight * (0.5 + 0.5 * (n.confidence || 0)) * (0.45 + 0.55 * reachNorm))
  }
  if (n.type === 'hashtag') {
    const vel: Record<string, number> = { peak: 2, high: 1.5, medium: 1, low: 0.6 }
    return Math.round(Math.log10(n.volume) * (vel[n.velocity] ?? 1) * 10)
  }
  return 0
}

export function threatBand(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'HIGH', color: SG.high }
  if (score >= 40) return { label: 'MEDIUM', color: SG.med }
  return { label: 'LOW', color: SG.low }
}

export function isHighThreatTag(tag: string): boolean {
  return HIGH_THREAT_TAGS.has(tag)
}

/**
 * Real-signal threat level for an account, derived from its classifier tags
 * (not followers, which collected sources don't expose). Mirrors nodeColor:
 * HIGH = carries a high-threat tag (coordinated/firehose/red-pill),
 * MEDIUM = flagged with any tag, LOW = clean / observed only.
 */
export function accountThreatLevel(n: SignetNode): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (n.type !== 'account') return 'LOW'
  if (n.tags?.some(t => HIGH_THREAT_TAGS.has(t))) return 'HIGH'
  if ((n.tags?.length ?? 0) > 0) return 'MEDIUM'
  return 'LOW'
}

function seed(str: string): () => number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = (h * 0x01000193) >>> 0
  }
  return () => { h = (h * 16807 + 17) >>> 0; return (h % 10000) / 10000 }
}

export function timeSeries(node: SignetNode, days: number): number[] {
  const rng = seed(node.id + ':' + days)
  if (node.type === 'account') {
    return Array.from({ length: days }, () => {
      const base = Math.floor(rng() * 7)
      const spike = rng() > 0.85 ? Math.floor(rng() * 8) : 0
      return base + spike
    })
  }
  if (node.type === 'narrative') {
    const peakIdx = Math.floor(days * 0.6)
    const decay = node.status === 'decaying' ? 0.32 : 0.92
    return Array.from({ length: days }, (_, i) => {
      if (i <= peakIdx) {
        const t = i / peakIdx
        return Math.round(node.reach * (0.25 + 0.75 * t) * (0.85 + rng() * 0.3))
      }
      const t = (i - peakIdx) / Math.max(1, days - peakIdx)
      return Math.round(node.reach * (1 - t * (1 - decay)) * (0.85 + rng() * 0.3))
    })
  }
  if (node.type === 'hashtag') {
    const vScale: Record<string, number> = { peak: 1.25, high: 1.0, medium: 0.7, low: 0.5 }
    return Array.from({ length: days }, (_, i) =>
      Math.round(node.volume * (vScale[node.velocity] ?? 1) * (0.55 + rng() * 0.6) * (1 + Math.sin(i / 2.5) * 0.18))
    )
  }
  return []
}

export function tierColor(tier: string): string {
  const map: Record<string, string> = { high: SG.high, medium: SG.med, low: SG.low }
  return map[tier] || SG.textLow
}
