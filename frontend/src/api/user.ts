import { apiRequest } from './client'
import type { Integration } from '@/types/user'

export interface CurrentUserResponse {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  date_joined: string
  auth_token?: string
  bio?: string
  location?: string
  website?: string
  role?: string
  industry?: string
  company_name?: string
  company_size?: string
  twitter_handle?: string
  linkedin_url?: string
  github_url?: string
  avatar?: string | null
  theme_preference?: string
  timezone?: string
  integrations?: Integration[]
}

export async function fetchCurrentUser(): Promise<CurrentUserResponse> {
  return apiRequest<CurrentUserResponse>('/user/me/')
}
