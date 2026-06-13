import { create } from 'zustand'
import type { BugBountyProgram, BugBountyReport, ReportDraft } from '@/types/bugBounty'
import {
  fetchPrograms,
  fetchReports,
  fetchDrafts,
  type ProgramResponse,
  type ReportResponse,
  type DraftResponse,
} from '@/api/bugbounty'

function mapProgram(p: ProgramResponse): BugBountyProgram {
  return {
    id: p.program_id,
    name: p.name,
    platform: p.platform as BugBountyProgram['platform'],
    assetCount: p.asset_count,
    lastScannedAt: p.last_scanned_at,
    bountyRange: p.bounty_range,
    inScope: p.in_scope,
    outOfScope: p.out_of_scope,
    rewardNotes: p.reward_notes,
    scanStatus: p.scan_status as BugBountyProgram['scanStatus'],
  }
}

function mapReport(r: ReportResponse): BugBountyReport {
  return {
    id: r.report_id,
    title: r.title,
    target: r.target,
    bountyKes: r.bounty_kes,
    platform: r.platform as BugBountyReport['platform'],
    programId: r.program_id,
    status: r.status as BugBountyReport['status'],
    submittedAt: r.submitted_at,
    severity: r.severity as BugBountyReport['severity'],
  }
}

function mapDraft(d: DraftResponse): ReportDraft {
  return {
    title: d.title,
    severity: d.severity as ReportDraft['severity'],
    platformProgram: d.platform_program,
    steps: d.steps,
    impact: d.impact,
    evidenceName: d.evidence_name,
    estimatedBounty: d.estimated_bounty,
  }
}

interface BugBountyState {
  programs: BugBountyProgram[]
  reports: BugBountyReport[]
  drafts: ReportDraft[]
  isLoading: boolean
  initialized: boolean
  lastFetched: number
  initialize: () => Promise<void>
}

const BB_STALE_MS = 30_000

export const useBugBountyStore = create<BugBountyState>((set, get) => ({
  programs: [],
  reports: [],
  drafts: [],
  isLoading: false,
  initialized: false,
  lastFetched: 0,

  initialize: async () => {
    const { initialized, lastFetched } = get()
    if (initialized && Date.now() - lastFetched < BB_STALE_MS) return
    set({ isLoading: true })
    try {
      const [programs, reports, drafts] = await Promise.all([
        fetchPrograms(),
        fetchReports(),
        fetchDrafts(),
      ])
      set({
        programs: programs.map(mapProgram),
        reports: reports.map(mapReport),
        drafts: drafts.map(mapDraft),
        isLoading: false,
        initialized: true,
        lastFetched: Date.now(),
      })
    } catch {
      set({ isLoading: false, initialized: true, lastFetched: Date.now() })
    }
  },
}))
