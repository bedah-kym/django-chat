import { create } from 'zustand'
import type { Wallet, Transaction } from '@/types/payments'
import { fetchBalance, fetchTransactions as apiFetchTransactions } from '@/api/payments'
import type { TransactionResponse } from '@/api/payments'

function mapTransactionType(t: string): Transaction['type'] {
  if (t === 'CREDIT') return 'deposit'
  if (t === 'DEBIT') return 'withdrawal'
  return 'payment'
}

function mapTransaction(t: TransactionResponse, id: number): Transaction {
  return {
    id,
    type: mapTransactionType(t.type),
    amount: t.amount,
    currency: 'KES',
    status: 'completed',
    description: t.description,
    createdAt: t.date,
  }
}

interface PaymentState {
  wallet: Wallet | null
  transactions: Transaction[]
  isLoading: boolean
  initialize: () => Promise<void>
  fetchBalance: () => Promise<void>
  fetchTransactions: () => Promise<void>
}

export const usePaymentStore = create<PaymentState>((set) => ({
  wallet: null,
  transactions: [],
  isLoading: false,

  initialize: async () => {
    set({ isLoading: true })
    try {
      const [balanceData, txData] = await Promise.all([
        fetchBalance(),
        apiFetchTransactions(),
      ])
      set({
        wallet: {
          balance: balanceData.balance,
          currency: balanceData.currency,
          lastUpdated: new Date().toISOString(),
        },
        transactions: txData.transactions.map((t, i) => mapTransaction(t, i + 1)),
        isLoading: false,
      })
    } catch {
      set({ isLoading: false })
    }
  },

  fetchBalance: async () => {
    try {
      const data = await fetchBalance()
      set({
        wallet: {
          balance: data.balance,
          currency: data.currency,
          lastUpdated: new Date().toISOString(),
        },
      })
    } catch {
    }
  },

  fetchTransactions: async () => {
    try {
      const data = await apiFetchTransactions()
      set({
        transactions: data.transactions.map((t, i) => mapTransaction(t, i + 1)),
      })
    } catch {
    }
  },
}))
