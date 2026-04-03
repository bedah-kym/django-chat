import { create } from 'zustand'
import type { Message, Room } from '@/types/chat'
import { mockRooms, mockMessages, mockOlderMessages } from '@/mocks/chat'

interface HistoryState {
  hasMore: boolean
  oldestMsgId: number | null
  isLoading: boolean
}

interface ChatState {
  rooms: Room[]
  messagesByRoom: Record<number, Message[]>
  activeRoomId: number | null

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
  sendMessage: (roomId: number, content: string, parentId?: number | null) => void
  getMessages: (roomId: number) => Message[]
  getTotalUnread: () => number
}

export const useChatStore = create<ChatState>((set, get) => ({
  rooms: mockRooms.map(r => ({ ...r })),
  messagesByRoom: Object.fromEntries(
    Object.entries(mockMessages).map(([k, v]) => [Number(k), [...v]])
  ),
  activeRoomId: null,

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
    // Re-run search with new dates
    get().setSearchQuery(get().searchQuery)
  },
  setSearchActiveIndex: (i) => set({ searchActiveIndex: i }),
  clearSearch: () => set({
    searchOpen: false, searchQuery: '', searchDateFrom: null, searchDateTo: null,
    searchResults: [], searchActiveIndex: 0,
  }),

  // Pagination
  historyState: Object.fromEntries(
    mockRooms.map(r => {
      const msgs = mockMessages[r.id]
      const oldest = msgs?.[0]
      return [r.id, { hasMore: !!(mockOlderMessages[r.id]?.length), oldestMsgId: oldest?.id ?? null, isLoading: false }]
    })
  ),
  loadOlderMessages: (roomId) => {
    const state = get()
    const hs = state.historyState[roomId]
    if (!hs || hs.isLoading || !hs.hasMore) return

    set(s => ({
      historyState: { ...s.historyState, [roomId]: { ...hs, isLoading: true } },
    }))

    // Simulate async load
    setTimeout(() => {
      const older = mockOlderMessages[roomId] ?? []
      const existing = get().messagesByRoom[roomId] ?? []
      const existingIds = new Set(existing.map(m => m.id))
      const newMsgs = older.filter(m => !existingIds.has(m.id))

      set(s => ({
        messagesByRoom: {
          ...s.messagesByRoom,
          [roomId]: [...newMsgs, ...(s.messagesByRoom[roomId] ?? [])],
        },
        historyState: {
          ...s.historyState,
          [roomId]: {
            hasMore: false, // One batch only for mock
            oldestMsgId: newMsgs[0]?.id ?? hs.oldestMsgId,
            isLoading: false,
          },
        },
      }))
    }, 800)
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
  sendMessage: (roomId, content, parentId) => {
    const newMsg: Message = {
      id: Date.now(),
      member: 'alex',
      content,
      timestamp: new Date().toISOString(),
      parentId: parentId ?? null,
      isAi: false,
    }
    set(s => ({
      messagesByRoom: {
        ...s.messagesByRoom,
        [roomId]: [...(s.messagesByRoom[roomId] ?? []), newMsg],
      },
      replyingTo: null,
    }))
  },
  getMessages: (roomId) => get().messagesByRoom[roomId] ?? [],
  getTotalUnread: () => get().rooms.reduce((sum, r) => sum + r.unreadCount, 0),
}))
