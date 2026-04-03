import type { User, UserProfile } from '@/types/user'

export const mockCurrentUser: UserProfile = {
  id: 1,
  username: 'alex',
  email: 'alex@mathia.co',
  displayName: 'Alex Mwangi',
  avatarUrl: undefined,
  isStaff: false,
  dateJoined: '2025-11-15T10:00:00Z',
  phone: '+254 712 345 678',
  company: 'TechVentures Ltd',
  timezone: 'Africa/Nairobi',
  integrations: [
    { type: 'calendly', connected: true, connectedAt: '2026-01-10T08:00:00Z', accountName: 'alex-mwangi' },
    { type: 'gmail', connected: true, connectedAt: '2026-02-05T12:00:00Z', accountName: 'alex@gmail.com' },
    { type: 'whatsapp', connected: false },
    { type: 'mailgun', connected: false },
    { type: 'intasend', connected: true, connectedAt: '2026-03-01T09:00:00Z', accountName: 'TechVentures' },
  ],
}

export const mockUsers: User[] = [
  mockCurrentUser,
  {
    id: 2,
    username: 'sarah',
    email: 'sarah@client.co',
    displayName: 'Sarah Kimani',
    isStaff: false,
    dateJoined: '2025-12-01T10:00:00Z',
  },
  {
    id: 3,
    username: 'james',
    email: 'james@partner.co',
    displayName: 'James Ochieng',
    isStaff: false,
    dateJoined: '2026-01-20T10:00:00Z',
  },
  {
    id: 4,
    username: 'mathia',
    email: 'mathia@mathia.co',
    displayName: 'Mathia AI',
    isStaff: false,
    dateJoined: '2025-01-01T00:00:00Z',
  },
]
