import type { LucideIcon } from 'lucide-react'
import {
  BriefcaseBusiness,
  Bug,
  CircleDollarSign,
  Clock,
  Code2,
  House,
  Plane,
  ScanEye,
  Settings,
  ShieldAlert,
} from 'lucide-react'
import type { DomainId } from '@/types/domain'
import type { Room } from '@/types/chat'

export interface DomainNavItem {
  label: string
  path: string
  icon: LucideIcon
}

export interface DomainConfig {
  id: DomainId
  label: string
  description: string
  icon: LucideIcon
  defaultRoute: string
  featureNav: DomainNavItem[]
}

export interface GlobalNavItem {
  label: string
  path: string
  icon: LucideIcon
  domain?: DomainId
}

export const domainConfigs: Record<DomainId, DomainConfig> = {
  security: {
    id: 'security',
    label: 'Security',
    description: 'Pentests, bug bounty programs, findings, and approvals.',
    icon: ShieldAlert,
    defaultRoute: '/app/security',
    featureNav: [
      { label: 'Overview', path: '/app/security', icon: ShieldAlert },
      { label: 'Pentest', path: '/app/security/pentest', icon: ShieldAlert },
      { label: 'Bug Bounty', path: '/app/security/bugbounty', icon: Bug },
    ],
  },
  dev: {
    id: 'dev',
    label: 'Dev',
    description: 'Repos, builds, deployments, and engineering workflows.',
    icon: Code2,
    defaultRoute: '/app/dev',
    featureNav: [
      { label: 'Overview', path: '/app/dev', icon: Code2 },
    ],
  },
  ops: {
    id: 'ops',
    label: 'Business/Ops',
    description: 'Wallet, invoices, reminders, travel, and operations.',
    icon: BriefcaseBusiness,
    defaultRoute: '/app/ops',
    featureNav: [
      { label: 'Overview', path: '/app/ops', icon: BriefcaseBusiness },
      { label: 'Wallet', path: '/app/ops/wallet', icon: CircleDollarSign },
      { label: 'Reminders', path: '/app/ops/reminders', icon: Clock },
      { label: 'Travel', path: '/app/ops/travel/itineraries', icon: Plane },
    ],
  },
  signet: {
    id: 'signet',
    label: 'Social Intel',
    description: 'Accounts, narratives, hashtags, and disinformation tracking.',
    icon: ScanEye,
    defaultRoute: '/app/signet',
    featureNav: [
      { label: 'Dashboard', path: '/app/signet', icon: ScanEye },
    ],
  },
}

export const domainOrder: DomainId[] = ['signet', 'security', 'dev', 'ops']

export const globalNavItems: GlobalNavItem[] = [
  { label: 'Home', path: '/app/home', icon: House },
  ...domainOrder.map((domainId) => {
    const domain = domainConfigs[domainId]
    return {
      label: domain.label,
      path: domain.defaultRoute,
      icon: domain.icon,
      domain: domain.id,
    }
  }),
  { label: 'Settings', path: '/app/settings', icon: Settings },
]

export function isDomainId(value: string | undefined): value is DomainId {
  return !!value && value in domainConfigs
}

export function getDomainFromPathname(pathname: string): DomainId | null {
  const match = pathname.match(/^\/app\/(signet|security|dev|ops)(?:\/|$)/)
  return match?.[1] ? (match[1] as DomainId) : null
}

export function getRoomPath(room: Pick<Room, 'id' | 'domain'>): string {
  return `/app/${room.domain}/chat/${room.id}`
}

export function getDomainPageTitle(domainId: DomainId, pathname: string, room?: Room | null): string {
  if (pathname.includes('/chat/') && room) return room.displayName
  const navItems = [...domainConfigs[domainId].featureNav].sort((a, b) => b.path.length - a.path.length)
  const match = navItems.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))
  return match?.label ?? domainConfigs[domainId].label
}

export function getDomainRooms(rooms: Room[], domainId: DomainId): Room[] {
  return rooms.filter((room) => room.domain === domainId)
}

export function getDomainIcon(domainId: DomainId): LucideIcon {
  return domainConfigs[domainId].icon
}

export const domainStatusCopy: Record<DomainId, string> = {
  signet: 'Accounts, narratives, hashtags, and disinformation patterns tracked.',
  security: 'Findings and approvals need attention.',
  dev: 'Release work, repo coordination, and staging health are active.',
  ops: 'Finance, reminders, and travel stay grouped here for now.',
}
