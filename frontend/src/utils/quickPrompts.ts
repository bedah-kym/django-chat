import type { LucideIcon } from 'lucide-react'
import {
  FileText, Wallet, Bell, Plane, Mail, ShieldCheck, MessageCircle,
} from 'lucide-react'

export interface PromptField {
  name: string
  label: string
  type: 'text' | 'email' | 'number' | 'date' | 'textarea' | 'select'
  required: boolean
  options?: string[]
  placeholder?: string
}

export interface QuickPromptAction {
  id: string
  label: string
  icon: LucideIcon
  fields: PromptField[]
  buildPrompt: (values: Record<string, string>) => string
}

export const QUICK_PROMPTS: QuickPromptAction[] = [
  {
    id: 'invoice',
    label: 'Send Invoice',
    icon: FileText,
    fields: [
      { name: 'amount', label: 'Amount (KES)', type: 'number', required: true, placeholder: '50000' },
      { name: 'payer', label: 'Payer Email', type: 'email', required: false, placeholder: 'client@example.com' },
      { name: 'desc', label: 'Description', type: 'text', required: true, placeholder: 'Consulting services' },
    ],
    buildPrompt: (v) => `@mathia create an invoice for ${v.amount} KES${v.payer ? ` to ${v.payer}` : ''} for ${v.desc} and email it`,
  },
  {
    id: 'balance',
    label: 'Balance & Txns',
    icon: Wallet,
    fields: [],
    buildPrompt: () => '@mathia show my balance and last 3 transactions',
  },
  {
    id: 'reminder',
    label: 'Set Reminder',
    icon: Bell,
    fields: [
      { name: 'content', label: 'Reminder', type: 'text', required: true, placeholder: 'Follow up with client' },
      { name: 'time', label: 'When', type: 'text', required: true, placeholder: 'Tomorrow at 10am' },
      { name: 'channel', label: 'Channel', type: 'select', required: true, options: ['email', 'whatsapp', 'both'] },
    ],
    buildPrompt: (v) => `@mathia set a reminder to "${v.content}" at ${v.time} via ${v.channel}`,
  },
  {
    id: 'flights',
    label: 'Find Flights',
    icon: Plane,
    fields: [
      { name: 'origin', label: 'From', type: 'text', required: true, placeholder: 'Nairobi' },
      { name: 'dest', label: 'To', type: 'text', required: true, placeholder: 'Mombasa' },
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'pax', label: 'Passengers', type: 'number', required: false, placeholder: '1' },
    ],
    buildPrompt: (v) => `@mathia find flights from ${v.origin} to ${v.dest} on ${v.date} for ${v.pax || '1'} passenger(s)`,
  },
  {
    id: 'email',
    label: 'Send Email',
    icon: Mail,
    fields: [
      { name: 'to', label: 'To', type: 'email', required: true, placeholder: 'recipient@example.com' },
      { name: 'subject', label: 'Subject', type: 'text', required: true, placeholder: 'Meeting follow-up' },
      { name: 'body', label: 'Body', type: 'textarea', required: true, placeholder: 'Hi...' },
    ],
    buildPrompt: (v) => `@mathia send an email to ${v.to} subject "${v.subject}" body: ${v.body}`,
  },
  {
    id: 'withdraw',
    label: 'Withdraw Check',
    icon: ShieldCheck,
    fields: [
      { name: 'phone', label: 'Phone', type: 'text', required: true, placeholder: '+254...' },
      { name: 'amount', label: 'Amount (KES)', type: 'number', required: true, placeholder: '10000' },
    ],
    buildPrompt: (v) => `@mathia check withdraw policy for ${v.phone} amount ${v.amount}`,
  },
  {
    id: 'whatsapp',
    label: 'Send WhatsApp',
    icon: MessageCircle,
    fields: [
      { name: 'phone', label: 'Phone', type: 'text', required: true, placeholder: '+254...' },
      { name: 'message', label: 'Message', type: 'textarea', required: true, placeholder: 'Hi, just following up...' },
    ],
    buildPrompt: (v) => `@mathia send a whatsapp to ${v.phone} saying: ${v.message}`,
  },
]
