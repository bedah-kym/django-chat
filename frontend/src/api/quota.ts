import { apiRequest } from './client'
import type { UserQuotas } from '@/types/quota'

export async function fetchUserQuotas(): Promise<UserQuotas> {
    return apiRequest<UserQuotas>('/user/quotas/')
}

export async function resetOwnQuotas(): Promise<{ status: string; quotas: UserQuotas }> {
    return apiRequest('/user/quotas/reset/', { method: 'POST' })
}
