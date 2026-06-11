import { apiRequest } from '@/api/client'
import type { Contact, ActionReceipt, Note } from '@/types/chat'

export interface RoomContext {
  summary: string
  activeTopics: string[]
  notes: Note[]
}

export async function fetchRoomContext(roomId: number): Promise<RoomContext> {
  const data = await apiRequest<{
    summary?: string
    active_topics?: string[]
    recent_notes?: { id: number; type: string; content: string; priority: string; created_at: string }[]
  }>(`/chatbot/api/rooms/${roomId}/context/`)
  return {
    summary: data.summary ?? '',
    activeTopics: data.active_topics ?? [],
    notes: (data.recent_notes ?? []).map(n => ({
      id: n.id,
      content: n.content,
      createdAt: n.created_at,
      author: (n.type || 'note').replace(/_/g, ' '),
      isPinned: n.priority === 'high',
    })),
  }
}

export async function fetchContacts(): Promise<Contact[]> {
  const data = await apiRequest<{ contacts: { id: number; name: string; email: string; phone?: string; company?: string; label?: string; source?: string; room_id?: number }[] }>('/chatbot/api/contacts/')
  return data.contacts.map(c => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    company: c.company,
    roomId: c.room_id ?? 0,
  }))
}

export async function fetchActionReceipts(roomId: number): Promise<ActionReceipt[]> {
  const data = await apiRequest<{ receipts: { id: number; action: string; service: string; summary: string; status: string; reversible: boolean; created_at: string }[] }>(`/chatbot/api/rooms/${roomId}/actions/`)
  return data.receipts.map(r => ({
    id: r.id,
    action: r.action,
    status: r.status as ActionReceipt['status'],
    timestamp: r.created_at,
    details: r.summary,
  }))
}

export async function fetchLinkedRooms(roomId: number): Promise<{ linked: { id: number; name: string }[]; linkable: { id: number; name: string }[] }> {
  return apiRequest(`/chatbot/api/rooms/${roomId}/linked/`)
}

export async function createContact(data: { name: string; email: string; phone?: string; label?: string }): Promise<{ id: number }> {
  return apiRequest('/chatbot/api/contacts/', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}
