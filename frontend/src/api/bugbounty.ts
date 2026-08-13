import { apiRequest } from '@/api/client'

export interface ProgramResponse {
  program_id: string
  name: string
  platform: string
  asset_count: number
  last_scanned_at: string
  bounty_range: string
  in_scope: string[]
  out_of_scope: string[]
  reward_notes: string
  scan_status: string
  external_id?: string
  source_handle?: string
}

export interface ReportResponse {
  report_id: string
  title: string
  target: string
  bounty_kes: number
  platform: string
  program_id: string
  status: string
  submitted_at: string
  severity: string
  source_url?: string
}

export interface DraftResponse {
  title: string
  severity: string
  platform_program: string
  steps: string
  impact: string
  evidence_name: string
  estimated_bounty: string
}

export function fetchPrograms(): Promise<ProgramResponse[]> {
  return apiRequest('/bugbounty/programs/')
}

export function fetchReports(): Promise<ReportResponse[]> {
  return apiRequest('/bugbounty/reports/')
}

export function fetchDrafts(): Promise<DraftResponse[]> {
  return apiRequest('/bugbounty/drafts/')
}

export interface HackerOneStatus {
  enabled: boolean
  configured: boolean
  ownerUsername: string | null
  isOwnerOrStaff: boolean
}

export interface HackerOneSyncResult {
  programs_created: number
  programs_updated: number
  reports_created: number
  reports_updated: number
  reports_skipped: number
}

export interface HackerOneImportPayload {
  program_handle: string
  title: string
  vulnerability_information: string
  impact: string
  severity?: string
}

export interface HackerOneImportResult {
  report_id: string
  url: string | null
}

export function fetchHackerOneStatus(): Promise<HackerOneStatus> {
  return apiRequest('/bugbounty/hackerone/status/')
}

export function syncHackerOne(): Promise<HackerOneSyncResult> {
  return apiRequest('/bugbounty/hackerone/sync/', { method: 'POST' })
}

export function importFindingToHackerone(payload: HackerOneImportPayload): Promise<HackerOneImportResult> {
  return apiRequest('/bugbounty/hackerone/import/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
