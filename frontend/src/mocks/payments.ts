import type { Wallet, Transaction, Invoice } from '@/types/payments'

export const mockWallet: Wallet = {
  balance: 142500,
  currency: 'KES',
  lastUpdated: '2026-04-03T10:00:00Z',
}

export const mockTransactions: Transaction[] = [
  { id: 1, type: 'deposit', amount: 100000, currency: 'KES', status: 'completed', description: 'M-Pesa deposit', createdAt: '2026-04-01T10:00:00Z', reference: 'DEP-001' },
  { id: 2, type: 'payment', amount: -25000, currency: 'KES', status: 'completed', description: 'Invoice #INV-2026-040 payment', createdAt: '2026-04-02T14:00:00Z', reference: 'PAY-012' },
  { id: 3, type: 'deposit', amount: 75000, currency: 'KES', status: 'completed', description: 'Client payment received', createdAt: '2026-04-03T09:00:00Z', reference: 'DEP-002' },
  { id: 4, type: 'withdrawal', amount: -7500, currency: 'KES', status: 'pending', description: 'Bank transfer', createdAt: '2026-04-03T11:00:00Z', reference: 'WTH-003' },
]

export const mockInvoices: Invoice[] = [
  { id: 1, referenceId: 'INV-2026-042', amount: 50000, currency: 'KES', status: 'sent', recipientName: 'Mombasa Client', recipientEmail: 'client@mombasa.co', description: 'Consulting — Phase 1 deposit', createdAt: '2026-04-03T09:15:00Z', dueDate: '2026-04-17T00:00:00Z' },
  { id: 2, referenceId: 'INV-2026-041', amount: 75000, currency: 'KES', status: 'paid', recipientName: 'ClientCorp', recipientEmail: 'finance@clientcorp.co', description: 'Monthly retainer — March', createdAt: '2026-03-28T10:00:00Z', dueDate: '2026-04-10T00:00:00Z' },
  { id: 3, referenceId: 'INV-2026-040', amount: 25000, currency: 'KES', status: 'overdue', recipientName: 'PartnerInc', recipientEmail: 'pay@partnerinc.co', description: 'Event coordination fee', createdAt: '2026-03-15T10:00:00Z', dueDate: '2026-03-30T00:00:00Z' },
]
