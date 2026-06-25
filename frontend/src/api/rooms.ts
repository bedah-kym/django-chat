import { apiRequest } from './client'
import type { Room, Message } from '@/types/chat'

interface RoomListResponse {
  rooms: {
    id: number
    name: string
    domain?: string
    participant_count: number
    last_message_at: string | null
    url: string
    has_ai: boolean
  }[]
  count: number
}

interface MessageResponse {
  member: string
  text: string
  timestamp: string
}

const MOCK_AI_NAMES = new Set(['mathia', 'Mathia AI', 'mathia_ai'])

function mapRoom(r: RoomListResponse['rooms'][0]): Room {
  return {
    id: r.id,
    name: r.name,
    displayName: r.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    domain: (r.domain as Room['domain']) || 'ops',
    lastMessage: '',
    lastMessageTime: r.last_message_at || '',
    unreadCount: 0,
    isAiRoom: r.has_ai,
    participants: [
      { username: 'you', displayName: 'You', isOnline: true },
    ],
  }
}

function mapMessage(m: MessageResponse, id: number): Message {
  return {
    id,
    member: m.member,
    content: m.text,
    timestamp: m.timestamp,
    parentId: null,
    isAi: MOCK_AI_NAMES.has(m.member),
  }
}

export async function fetchRooms(): Promise<Room[]> {
  const data = await apiRequest<RoomListResponse>('/rooms/list/')
  return data.rooms.map(mapRoom)
}

export async function fetchMessages(roomId: number): Promise<Message[]> {
  const data = await apiRequest<MessageResponse[]>(`/getmessages/${roomId}/`)
  return data.map((m, i) => mapMessage(m, i + 1))
}

export async function fetchUserProfile() {
  return apiRequest<{
    username: string
    email: string
    first_name: string
    last_name: string
  }>('/user/me/')
}
