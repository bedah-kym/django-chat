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
  phone?: string
  company?: string
  timezone?: string
  integrations: Integration[]
}

export interface Integration {
  type: 'calendly' | 'gmail' | 'whatsapp' | 'mailgun' | 'intasend'
  connected: boolean
  connectedAt?: string
  accountName?: string
}
