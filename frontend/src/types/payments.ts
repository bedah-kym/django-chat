export interface Wallet {
  balance: number
  currency: string
  lastUpdated: string
}

export interface Transaction {
  id: number
  type: 'deposit' | 'withdrawal' | 'payment' | 'refund'
  amount: number
  currency: string
  status: 'completed' | 'pending' | 'failed'
  description: string
  createdAt: string
  reference?: string
}

export interface Invoice {
  id: number
  referenceId: string
  amount: number
  currency: string
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  recipientName: string
  recipientEmail: string
  description: string
  createdAt: string
  dueDate: string
}
