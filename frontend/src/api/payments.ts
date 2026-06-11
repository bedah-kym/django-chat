import { getAuthToken } from './client'

export interface BalanceResponse {
  balance: number
  currency: string
}

export interface TransactionResponse {
  date: string
  description: string
  amount: number
  type: 'CREDIT' | 'DEBIT'
}

export interface TransactionsListResponse {
  transactions: TransactionResponse[]
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken()
  return token ? { 'Authorization': `Token ${token}` } : {}
}

export async function fetchBalance(): Promise<BalanceResponse> {
  const res = await fetch('/payments/api/balance/', {
    headers: authHeaders(),
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`Payments API error: ${res.status}`)
  return res.json()
}

export async function fetchTransactions(): Promise<TransactionsListResponse> {
  const res = await fetch('/payments/api/transactions/', {
    headers: authHeaders(),
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`Payments API error: ${res.status}`)
  return res.json()
}
