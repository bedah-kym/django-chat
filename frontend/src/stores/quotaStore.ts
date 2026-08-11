import { create } from 'zustand'
import type { UserQuotas } from '@/types/quota'
import { fetchUserQuotas, resetOwnQuotas } from '@/api/quota'

interface QuotaState {
    quotas: UserQuotas | null
    loading: boolean
    error: string | null
    lastFetched: number | null

    fetchQuotas: () => Promise<void>
    resetQuotas: () => Promise<void>
}

export const useQuotaStore = create<QuotaState>((set, get) => ({
    quotas: null,
    loading: false,
    error: null,
    lastFetched: null,

    fetchQuotas: async () => {
        // Throttle: don't refetch within 10 seconds
        const { lastFetched, loading } = get()
        if (loading) return
        if (lastFetched && Date.now() - lastFetched < 10_000) return

        set({ loading: true, error: null })
        try {
            const quotas = await fetchUserQuotas()
            set({ quotas, loading: false, lastFetched: Date.now() })
        } catch (err: any) {
            set({ error: err.message || 'Failed to fetch quotas', loading: false })
        }
    },

    resetQuotas: async () => {
        set({ loading: true, error: null })
        try {
            const result = await resetOwnQuotas()
            set({ quotas: result.quotas, loading: false, lastFetched: Date.now() })
        } catch (err: any) {
            set({ error: err.message || 'Failed to reset quotas', loading: false })
        }
    },
}))
