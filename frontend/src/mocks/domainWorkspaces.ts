import type { DomainId } from '@/types/domain'

type WorkspaceTone = 'default' | 'success' | 'warning' | 'critical' | 'info' | 'muted'

export interface DomainWorkspaceMetric {
  label: string
  value: string
  detail: string
  tone?: 'default' | 'critical' | 'warning' | 'success' | 'info'
}

export interface DomainWorkspaceFeedItem {
  id: string
  title: string
  detail: string
  timestamp: string
  tone?: WorkspaceTone
}

export interface DomainWorkspaceAction {
  id: string
  label: string
  detail: string
  owner: string
  status: string
  tone?: WorkspaceTone
}

export interface DomainWorkspaceContent {
  eyebrow: string
  title: string
  description: string
  metrics: DomainWorkspaceMetric[]
  feed: DomainWorkspaceFeedItem[]
  actions: DomainWorkspaceAction[]
}

export const mockDomainWorkspaces: Partial<Record<DomainId, DomainWorkspaceContent>> = {
  social: {
    eyebrow: 'Social command',
    title: 'Campaign flow stays in motion.',
    description:
      'Drafts, approvals, and publishing windows are already staged so the workspace feels alive before connectors land.',
    metrics: [
      { label: 'Drafts in review', value: '12', detail: '4 need copy approval today', tone: 'warning' },
      { label: 'Channels active', value: '5', detail: 'LinkedIn, X, Instagram, TikTok, email', tone: 'info' },
      { label: 'Posts queued', value: '27', detail: 'Next 72 hours are fully scheduled', tone: 'success' },
    ],
    feed: [
      {
        id: 'social-1',
        title: 'Launch week teaser approved',
        detail: 'The mobile teaser cut is cleared for LinkedIn and Instagram placement.',
        timestamp: '2026-04-08T09:10:00Z',
        tone: 'success',
      },
      {
        id: 'social-2',
        title: 'Creator brief needs legal pass',
        detail: 'Usage rights for the UGC bundle are still pending before export.',
        timestamp: '2026-04-08T08:20:00Z',
        tone: 'warning',
      },
      {
        id: 'social-3',
        title: 'Audience spike on Nairobi fintech segment',
        detail: 'Engagement is trending higher than baseline across short-form clips.',
        timestamp: '2026-04-07T17:45:00Z',
        tone: 'info',
      },
    ],
    actions: [
      {
        id: 'social-a1',
        label: 'Approve Q2 founder thread',
        detail: 'Needs final voice pass before 5:00 PM schedule lock.',
        owner: 'Miriam',
        status: 'Awaiting sign-off',
        tone: 'warning',
      },
      {
        id: 'social-a2',
        label: 'Refresh April content calendar',
        detail: 'Replace two underperforming slots with the product proof sequence.',
        owner: 'Mathia',
        status: 'Ready',
        tone: 'default',
      },
      {
        id: 'social-a3',
        label: 'Localize paid copy set',
        detail: 'Prepare EN/FR variants for the East and West Africa campaign mix.',
        owner: 'Aisha',
        status: 'In progress',
        tone: 'info',
      },
    ],
  },
  dev: {
    eyebrow: 'Engineering command',
    title: 'Release work is visible and moving.',
    description:
      'Build health, release sequencing, and repo coordination are represented with enough shape to behave like a real engineering workspace.',
    metrics: [
      { label: 'PRs awaiting review', value: '9', detail: '3 tagged release-blocking', tone: 'warning' },
      { label: 'Pipelines green', value: '14/16', detail: 'Two flaky suites still need triage', tone: 'info' },
      { label: 'Deployments queued', value: '3', detail: 'Next window starts at 16:00 UTC', tone: 'success' },
    ],
    feed: [
      {
        id: 'dev-1',
        title: 'Release candidate tagged for v2.4.0',
        detail: 'Frontend shell fixes and queue UX updates are bundled for staging.',
        timestamp: '2026-04-08T09:30:00Z',
        tone: 'success',
      },
      {
        id: 'dev-2',
        title: 'Payments E2E suite regressed on Safari',
        detail: 'One flaky checkout assertion is blocking a full green board.',
        timestamp: '2026-04-08T07:55:00Z',
        tone: 'critical',
      },
      {
        id: 'dev-3',
        title: 'Infra patch window confirmed',
        detail: 'Staging database maintenance is scheduled for tonight with no prod impact.',
        timestamp: '2026-04-07T20:15:00Z',
        tone: 'muted',
      },
    ],
    actions: [
      {
        id: 'dev-a1',
        label: 'Review release checklist',
        detail: 'Security approval, migration note, and rollback script still need confirmation.',
        owner: 'James',
        status: 'Needs review',
        tone: 'warning',
      },
      {
        id: 'dev-a2',
        label: 'Triage flaky checkout spec',
        detail: 'Reduce intermittent timeout in WebKit coverage before merge freeze.',
        owner: 'Mathia',
        status: 'Investigating',
        tone: 'critical',
      },
      {
        id: 'dev-a3',
        label: 'Prepare API changelog',
        detail: 'Summarize auth and billing endpoint deltas for integrators.',
        owner: 'Grace',
        status: 'Drafting',
        tone: 'info',
      },
    ],
  },
}
