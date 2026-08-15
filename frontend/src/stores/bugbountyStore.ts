import { create } from 'zustand'
import type { BugBountyProgram, BugBountyReport, ReportDraft, BugBountyCampaign, BugBountyAsset, BugBountyOrg } from '@/types/bugBounty'
import {
  fetchPrograms,
  fetchReports,
  fetchDrafts,
  fetchCampaigns,
  fetchAssets,
  fetchOrgs,
  fetchHackerOneStatus,
  syncHackerOne,
  type ProgramResponse,
  type ReportResponse,
  type DraftResponse,
  type CampaignResponse,
  type AssetResponse,
  type OrgResponse,
  type HackerOneStatus,
  type HackerOneSyncResult,
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
    externalId: p.external_id,
    sourceHandle: p.source_handle,
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
    sourceUrl: r.source_url,
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

function mapCampaign(c: CampaignResponse): BugBountyCampaign {
  return {
    id: c.campaign_id,
    programId: c.program,
    name: c.name,
    multiplier: c.multiplier,
    startsAt: c.starts_at,
    endsAt: c.ends_at,
    status: c.status,
  }
}

function mapAsset(a: AssetResponse): BugBountyAsset {
  return {
    id: a.asset_id,
    assetType: a.asset_type,
    identifier: a.identifier,
    state: a.state,
  }
}

function mapOrg(o: OrgResponse): BugBountyOrg {
  return {
    id: o.org_id,
    handle: o.handle,
    name: o.name,
    memberCount: o.member_count,
  }
}

interface BugBountyState {
  programs: BugBountyProgram[]
  reports: BugBountyReport[]
  drafts: ReportDraft[]
  campaigns: BugBountyCampaign[]
  assets: BugBountyAsset[]
  orgs: BugBountyOrg[]
  isLoading: boolean
  initialized: boolean
  lastFetched: number
  hackeroneStatus: HackerOneStatus | null
  isSyncing: boolean
  lastSyncResult: HackerOneSyncResult | null
  syncError: string | null
  initialize: () => Promise<void>
  refresh: () => Promise<void>
  loadHackerOneStatus: () => Promise<void>
  syncHackerOne: () => Promise<void>
}

const BB_STALE_MS = 30_000

export const useBugBountyStore = create<BugBountyState>((set, get) => ({
  programs: [],
  reports: [],
  drafts: [],
  campaigns: [],
  assets: [],
  orgs: [],
  isLoading: false,
  initialized: false,
  lastFetched: 0,
  hackeroneStatus: null,
  isSyncing: false,
  lastSyncResult: null,
  syncError: null,

  initialize: async () => {
    const { initialized, lastFetched } = get()
    if (initialized && Date.now() - lastFetched < BB_STALE_MS) return
    await get().refresh()
  },

  refresh: async () => {
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
      })

      // Best-effort: don't let campaign/asset/org failures wipe the core data
      // (e.g. before the backend migration for these tables has deployed).
      const [campaigns, assets, orgs] = await Promise.allSettled([
        fetchCampaigns(),
        fetchAssets(),
        fetchOrgs(),
      ])
      set({
        campaigns: campaigns.status === 'fulfilled' ? campaigns.value.map(mapCampaign) : [],
        assets: assets.status === 'fulfilled' ? assets.value.map(mapAsset) : [],
        orgs: orgs.status === 'fulfilled' ? orgs.value.map(mapOrg) : [],
        isLoading: false,
        initialized: true,
        lastFetched: Date.now(),
      })
    } catch {
      set({ isLoading: false, initialized: true, lastFetched: Date.now() })
    }
  },

  loadHackerOneStatus: async () => {
    try {
      const status = await fetchHackerOneStatus()
      set({ hackeroneStatus: status })
    } catch {
      set({ hackeroneStatus: null })
    }
  },

  syncHackerOne: async () => {
    if (get().isSyncing) return
    set({ isSyncing: true, syncError: null, lastSyncResult: null })
    try {
      const result = await syncHackerOne()
      set({ isSyncing: false, lastSyncResult: result })
      // Force-refresh local rows so the UI reflects freshly synced data.
      await get().refresh()
      await get().loadHackerOneStatus()
    } catch (err) {
      set({
        isSyncing: false,
        syncError: err instanceof Error ? err.message : 'Sync failed',
      })
    }
  },
}))
