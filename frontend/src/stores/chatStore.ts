import { create } from 'zustand'
import type { Message, Room } from '@/types/chat'
import { fetchRooms, fetchMessages } from '@/api/rooms'
import { getChatSocket } from '@/api/chatSocket'
import { useAuthStore } from './authStore'

interface HistoryState {
  hasMore: boolean
  oldestMsgId: number | null
  isLoading: boolean
}

interface ChatState {
  rooms: Room[]
  messagesByRoom: Record<number, Message[]>
  activeRoomId: number | null
  isInitialized: boolean
  isLoadingRooms: boolean

  initialize: () => Promise<void>
  fetchRoomMessages: (roomId: number) => Promise<void>

  // Reply
  replyingTo: Message | null
  setReplyingTo: (msg: Message | null) => void

  // Search
  searchOpen: boolean
  searchQuery: string
  searchDateFrom: string | null
  searchDateTo: string | null
  searchResults: number[]
  searchActiveIndex: number
  setSearchOpen: (open: boolean) => void
  setSearchQuery: (q: string) => void
  setSearchDateRange: (from: string | null, to: string | null) => void
  setSearchActiveIndex: (i: number) => void
  clearSearch: () => void

  // Pagination
  historyState: Record<number, HistoryState>
  loadOlderMessages: (roomId: number) => void

  // Notifications
  markRoomAsRead: (roomId: number) => void

  // Core
  setActiveRoom: (roomId: number) => void
  addRoom: (room: Room) => void
  sendMessage: (roomId: number, content: string, parentId?: number | null) => void
  editMessage: (roomId: number, messageId: number, content: string) => void
  deleteMessage: (roomId: number, messageId: number) => void
  addMessage: (roomId: number, msg: Message) => void
  setMessages: (roomId: number, msgs: Message[], hasMore: boolean, oldestId: number | null) => void
  updateStreamingMessage: (roomId: number, chunk: string, isFinal: boolean) => void
  finalizeStreamingMessage: (roomId: number, msg: Message) => void
  getMessages: (roomId: number) => Message[]
  getTotalUnread: () => number
}

export const useChatStore = create<ChatState>((set, get) => ({
  rooms: [],
  messagesByRoom: {},
  activeRoomId: null,
  isInitialized: false,
  isLoadingRooms: false,

  initialize: async () => {
    set({ isLoadingRooms: true })
    try {
      const rooms = await fetchRooms()
      set({
        rooms,
        isInitialized: true,
        isLoadingRooms: false,
      })
    } catch {
      set({
        isInitialized: true,
        isLoadingRooms: false,
      })
    }
  },

  fetchRoomMessages: async (roomId: number) => {
    try {
      const msgs = await fetchMessages(roomId)
      if (msgs.length > 0) {
        set(s => ({
          messagesByRoom: {
            ...s.messagesByRoom,
            [roomId]: msgs,
          },
          historyState: {
            ...s.historyState,
            [roomId]: {
              hasMore: false,
              oldestMsgId: msgs[0]?.id ?? null,
              isLoading: false,
            },
          },
        }))
      }
    } catch {
      // Keep mock data on failure
    }
  },

  // Reply
  replyingTo: null,
  setReplyingTo: (msg) => set({ replyingTo: msg }),

  // Search
  searchOpen: false,
  searchQuery: '',
  searchDateFrom: null,
  searchDateTo: null,
  searchResults: [],
  searchActiveIndex: 0,
  setSearchOpen: (open) => set({ searchOpen: open }),
  setSearchQuery: (q) => {
    const state = get()
    const roomId = state.activeRoomId
    if (!roomId) return set({ searchQuery: q, searchResults: [], searchActiveIndex: 0 })
    const msgs = state.messagesByRoom[roomId] ?? []
    const lower = q.toLowerCase()
    const results = q
      ? msgs
          .filter(m => {
            if (!m.content.toLowerCase().includes(lower)) return false
            if (state.searchDateFrom && m.timestamp < state.searchDateFrom) return false
            if (state.searchDateTo && m.timestamp > state.searchDateTo + 'T23:59:59') return false
            return true
          })
          .map(m => m.id)
      : []
    set({ searchQuery: q, searchResults: results, searchActiveIndex: 0 })
  },
  setSearchDateRange: (from, to) => {
    set({ searchDateFrom: from, searchDateTo: to })
    get().setSearchQuery(get().searchQuery)
  },
  setSearchActiveIndex: (i) => set({ searchActiveIndex: i }),
  clearSearch: () => set({
    searchOpen: false, searchQuery: '', searchDateFrom: null, searchDateTo: null,
    searchResults: [], searchActiveIndex: 0,
  }),

  // Pagination
  historyState: {},
  loadOlderMessages: (roomId: number) => {
    // TODO: implement pagination via API when available
    void roomId
  },

  // Notifications
  markRoomAsRead: (roomId) => set(s => ({
    rooms: s.rooms.map(r => r.id === roomId ? { ...r, unreadCount: 0 } : r),
  })),

  // Core
  setActiveRoom: (roomId) => {
    set({ activeRoomId: roomId })
    get().markRoomAsRead(roomId)
  },
  addRoom: (room: Room) => set(s => ({
    rooms: s.rooms.some(r => r.id === room.id) ? s.rooms : [...s.rooms, room],
  })),
  sendMessage: (_roomId, content, parentId) => {
    const socket = getChatSocket()
    if (socket.isConnected()) {
      const pendingId = -(Date.now())
      const username = useAuthStore.getState().username || ''
      const msg: Message = {
        id: pendingId,
        member: username,
        content,
        timestamp: new Date().toISOString(),
        parentId: parentId ?? null,
        isAi: false,
        isPending: true,
      }
      set(s => ({
        messagesByRoom: {
          ...s.messagesByRoom,
          [_roomId]: [...(s.messagesByRoom[_roomId] ?? []), msg],
        },
        replyingTo: null,
      }))
      socket.sendMessage(content, parentId)
    }
  },
  editMessage: (_roomId, messageId, content) => {
    const socket = getChatSocket()
    if (socket.isConnected()) {
      socket.editMessage(messageId, content)
    }
  },
  deleteMessage: (_roomId, messageId) => {
    const socket = getChatSocket()
    if (socket.isConnected()) {
      socket.deleteMessage(messageId)
    }
  },
  addMessage: (roomId, msg) => set(s => {
    const existing = s.messagesByRoom[roomId] ?? []
    if (existing.some(m => m.id === msg.id)) return {}
    return {
      messagesByRoom: {
        ...s.messagesByRoom,
        [roomId]: [...existing, msg],
      },
    }
  }),
  setMessages: (roomId, msgs, hasMore, oldestId) => set(s => ({
    messagesByRoom: {
      ...s.messagesByRoom,
      [roomId]: msgs,
    },
    historyState: {
      ...s.historyState,
      [roomId]: { hasMore, oldestMsgId: oldestId, isLoading: false },
    },
  })),
  updateStreamingMessage: (roomId, chunk, isFinal) => set(s => {
    const msgs = [...(s.messagesByRoom[roomId] ?? [])]
    const lastIdx = msgs.length - 1
    const last = msgs[lastIdx]
    if (last && last.isStreaming) {
      msgs[lastIdx] = {
        ...last,
        content: last.content + chunk,
        isStreaming: !isFinal,
      }
    } else if (!isFinal) {
      msgs.push({
        id: Date.now(),
        member: 'mathia',
        content: chunk,
        timestamp: new Date().toISOString(),
        parentId: null,
        isAi: true,
        isStreaming: true,
      })
    }
    return { messagesByRoom: { ...s.messagesByRoom, [roomId]: msgs } }
  }),
  finalizeStreamingMessage: (roomId, msg) => set(s => {
    const msgs = [...(s.messagesByRoom[roomId] ?? [])]
    const last = msgs[msgs.length - 1]
    if (last && last.isStreaming) {
      msgs[msgs.length - 1] = { ...msg, isAi: true, isStreaming: false }
    } else {
      if (!msgs.some(m => m.id === msg.id)) {
        msgs.push({ ...msg, isAi: true })
      }
    }
    return { messagesByRoom: { ...s.messagesByRoom, [roomId]: msgs } }
  }),
  getMessages: (roomId) => get().messagesByRoom[roomId] ?? [],
  getTotalUnread: () => get().rooms.reduce((sum, r) => sum + r.unreadCount, 0),
}))
