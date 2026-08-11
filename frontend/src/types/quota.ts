export interface QuotaCategory {
    name: string
    used: number
    limit: number
    unit: string
    status: 'good' | 'warning' | 'critical' | 'exhausted'
    color: 'green' | 'yellow' | 'orange' | 'red'
    reset: string
}

export interface UserQuotas {
    plan: string
    search: QuotaCategory
    actions: QuotaCategory
    messages: QuotaCategory
    uploads: QuotaCategory
    tokens: QuotaCategory
}
