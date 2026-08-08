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
