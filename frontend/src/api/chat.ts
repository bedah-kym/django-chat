import { chatbotApiRequest } from '@/api/client'
import type { Contact, ActionReceipt, Note } from '@/types/chat'

export async function fetchContacts(): Promise<Contact[]> {
  const data = await chatbotApiRequest<{ contacts: { id: number; name: string; email: string; phone?: string; company?: string; label?: string; source?: string; room_id?: number }[] }>('/api/contacts/')
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
  const data = await chatbotApiRequest<{ receipts: { id: number; action: string; service: string; summary: string; status: string; reversible: boolean; created_at: string }[] }>(`/api/rooms/${roomId}/actions/`)
  return data.receipts.map(r => ({
    id: r.id,
    action: r.action,
    status: r.status as ActionReceipt['status'],
    timestamp: r.created_at,
    details: r.summary,
  }))
}

export async function fetchLinkedRooms(roomId: number): Promise<{ linked: { id: number; name: string }[]; linkable: { id: number; name: string }[] }> {
  return chatbotApiRequest(`/api/rooms/${roomId}/linked/`)
}

export async function createContact(data: { name: string; email: string; phone?: string; label?: string }): Promise<{ id: number }> {
  return chatbotApiRequest('/api/contacts/', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export interface MemoryFact {
  key: string
  value: string
  confidence?: number
}

export interface MemoryEpisode {
  summary: string
  date?: string
  importance?: string
}

export interface RoomContext {
  summary: string
  activeTopics: string[]
  notes: Note[]
  memoryFacts: MemoryFact[]
  memoryPreferences: MemoryFact[]
  memoryEpisodes: MemoryEpisode[]
  memoryUpdatedAt: string | null
}

export async function fetchRoomContext(roomId: number): Promise<RoomContext> {
  const data = await chatbotApiRequest<{
    summary?: string
    active_topics?: string[]
    recent_notes?: { id: number; type: string; content: string; priority: string; created_at: string }[]
    memory_facts?: MemoryFact[]
    memory_preferences?: MemoryFact[]
    memory_episodes?: MemoryEpisode[]
    memory_updated_at?: string | null
  }>(`/api/rooms/${roomId}/context/`)
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
    memoryFacts: data.memory_facts ?? [],
    memoryPreferences: data.memory_preferences ?? [],
    memoryEpisodes: data.memory_episodes ?? [],
    memoryUpdatedAt: data.memory_updated_at ?? null,
  }
}

export async function markRoomRead(roomId: number): Promise<void> {
  await chatbotApiRequest(`/api/rooms/${roomId}/read/`, { method: 'POST' })
}

export async function addNote(
  roomId: number,
  data: { note_type: string; content: string; priority?: string; tags?: string[] },
): Promise<{ id: number; type: string; content: string; priority: string; created_at: string }> {
  return chatbotApiRequest(`/api/rooms/${roomId}/notes/`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function pinMessage(roomId: number, messageId: number): Promise<{ id: number }> {
  return chatbotApiRequest(`/api/rooms/${roomId}/messages/${messageId}/pin/`, { method: 'POST' })
}

export async function retryAiMessage(roomId: number, messageId: number): Promise<void> {
  await chatbotApiRequest(`/api/rooms/${roomId}/messages/${messageId}/retry/`, { method: 'POST' })
}

export async function submitMessageFeedback(
  roomId: number,
  messageId: number,
  rating: 'up' | 'down' | null,
): Promise<{ status: string; rating?: string }> {
  return chatbotApiRequest(`/api/rooms/${roomId}/messages/${messageId}/feedback/`, {
    method: 'POST',
    body: JSON.stringify({ rating }),
  })
}

export async function linkRoom(roomId: number, targetRoomId: number): Promise<void> {
  await chatbotApiRequest(`/api/rooms/${roomId}/linked/`, {
    method: 'POST',
    body: JSON.stringify({ target_room_id: targetRoomId }),
  })
}

export async function unlinkRoom(roomId: number, targetRoomId: number): Promise<void> {
  await chatbotApiRequest(`/api/rooms/${roomId}/linked/${targetRoomId}/`, { method: 'DELETE' })
}

export async function inviteToRoom(roomId: number, email: string): Promise<{ status: string; message?: string }> {
  return chatbotApiRequest('/invite/', {
    method: 'POST',
    body: JSON.stringify({ room_id: roomId, email }),
  })
}

export interface UploadQuota {
  used: number
  limit: number
}

export async function fetchUploadQuota(roomId: number): Promise<UploadQuota> {
  return chatbotApiRequest<UploadQuota>(`/api/rooms/${roomId}/documents/quota/`)
}

export async function uploadDocument(roomId: number, file: File): Promise<{ id: number; name: string; url: string; type: string; size: number }> {
  const formData = new FormData()
  formData.append('file', file)

  const token = (await import('@/api/client')).getAuthToken()
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Token ${token}`

  const res = await fetch(`/chatbot/api/rooms/${roomId}/documents/upload/`, {
    method: 'POST',
    headers,
    body: formData,
    credentials: 'include',
  })

  if (res.status === 429) throw new Error('QUOTA_EXCEEDED')
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`)

  return res.json()
}
