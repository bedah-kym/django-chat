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
