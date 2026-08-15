export type BugBountyPlatform = 'HackerOne' | 'Bugcrowd' | 'Intigriti'

export interface BugBountyProgram {
  id: string
  name: string
  platform: BugBountyPlatform
  assetCount: number
  lastScannedAt: string
  bountyRange: string
  inScope: string[]
  outOfScope: string[]
  rewardNotes: string
  scanStatus: 'ready' | 'queued' | 'running'
  externalId?: string
  sourceHandle?: string
}

export interface BugBountyReport {
  id: string
  title: string
  target: string
  bountyKes: number
  platform: BugBountyPlatform
  programId: string
  status: 'draft' | 'triaged' | 'duplicate' | 'resolved' | 'paid'
  submittedAt: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  sourceUrl?: string
}

export interface ReportDraft {
  title: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  platformProgram: string
  steps: string
  impact: string
  evidenceName: string
  estimatedBounty: string
}

export interface BugBountyCampaign {
  id: string
  programId: number
  name: string
  multiplier: string
  startsAt: string | null
  endsAt: string | null
  status: string
}

export interface BugBountyAsset {
  id: string
  assetType: string
  identifier: string
  state: string
}

export interface BugBountyOrg {
  id: string
  handle: string
  name: string
  memberCount: number
}
