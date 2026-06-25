import type { DomainId } from '@/types/domain'

export interface Room {
  id: number
  name: string
  displayName: string
  domain: DomainId
  lastMessage: string
  lastMessageTime: string
  unreadCount: number
  avatarUrl?: string
  isAiRoom: boolean
  participants: Participant[]
}

export interface Participant {
  username: string
  displayName: string
  avatarUrl?: string
  isOnline: boolean
  lastSeen?: string
}

export interface Message {
  id: number
  member: string
  content: string
  timestamp: string
  parentId: number | null
  isAi: boolean
  audioUrl?: string
  voiceTranscript?: string
  attachments?: Attachment[]
  // AI-specific message parts
  thinking?: string
  thinkingDurationMs?: number
  toolCalls?: ToolCall[]
  isStreaming?: boolean
  isTemp?: boolean
  isPending?: boolean
  editedAt?: string | null
  isDeleted?: boolean
}

export interface ToolCall {
  name: string
  status: 'calling' | 'result' | 'cancelled'
  result?: string
}

export interface Attachment {
  id: number
  name: string
  url: string
  type: 'image' | 'video' | 'audio' | 'file' | 'document'
  size: number
  mime?: string
  aiReadable?: boolean
  aiDocumentId?: number | null
}

export interface Contact {
  id: number
  name: string
  email: string
  phone?: string
  company?: string
  roomId: number
}

export interface Note {
  id: number
  content: string
  createdAt: string
  isPinned: boolean
  author: string
}

export interface ActionReceipt {
  id: number
  action: string
  status: 'completed' | 'pending' | 'failed'
  timestamp: string
  details: string
}

export interface LinkedRoom {
  id: number
  name: string
  displayName: string
}
