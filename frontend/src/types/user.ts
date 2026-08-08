export interface User {
  id: number
  username: string
  email: string
  displayName: string
  avatarUrl?: string
  isStaff: boolean
  dateJoined: string
}

export interface UserProfile extends User {
  firstName?: string
  lastName?: string
  phone?: string
  timezone?: string
  bio?: string
  location?: string
  website?: string
  role?: string
  industry?: string
  companyName?: string
  companySize?: '1-10' | '11-50' | '51-200' | '201-1000' | '1000+'
  twitterHandle?: string
  linkedinUrl?: string
  githubUrl?: string
  inviteDepth?: number
  integrations: Integration[]
}

export interface Integration {
  type: 'calendly' | 'gmail' | 'whatsapp' | 'intasend'
  connected: boolean
  connectedAt?: string
  accountName?: string
}

export type CapabilityMode = 'custom' | 'conserve' | 'balanced' | 'max'
export type NudgeFrequency = 'off' | 'low' | 'medium' | 'high'
export type SnoozeOption = 'none' | '1h' | '8h' | '24h' | '3d'

export interface CapabilitySettings {
  mode: CapabilityMode
  proactiveAssistant: boolean
  aiVoice: boolean
  managerLlm: boolean
  nudgeFrequency: NudgeFrequency
  snoozeUntil: SnoozeOption
  allowWebSearch: boolean
  allowTravel: boolean
  allowPayments: boolean
  allowReminders: boolean
  allowEmail: boolean
  allowWhatsapp: boolean
  allowCalendar: boolean
}

export interface NotificationChannel {
  inApp: boolean
  email: boolean
  whatsapp: boolean
}

export type NotificationEventKey =
  | 'payment.deposit'
  | 'payment.withdrawal'
  | 'payment.invoice'
  | 'payment.error'
  | 'reminder.due'
  | 'message.unread'
  | 'message.mention'
  | 'system.info'
  | 'system.warning'

export type NotificationMatrix = Record<NotificationEventKey, NotificationChannel>

export interface AssistantStyle {
  tone: 'friendly' | 'formal' | 'direct' | 'warm' | 'casual'
  verbosity: 'short' | 'balanced' | 'detailed'
  directness: 'direct' | 'neutral' | 'polite'
  locale: string
  dateOrder: 'DMY' | 'MDY' | 'YMD'
  timeFormat: '24h' | '12h'
  currency: string
}

export interface WorkspaceInfo {
  name: string
  plan: 'free' | 'trial' | 'pro' | 'agency'
  accountType: 'personal' | 'team' | 'business'
  trialActive: boolean
  trialEndsAt?: string
}

export interface PlatformInvite {
  email: string
  status: 'activated' | 'pending' | 'expired'
  sentAt: string
}
