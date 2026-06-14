import { useEffect, useRef, useState, useCallback } from 'react'
import { getChatSocket } from '@/api/chatSocket'
import { useAuthStore } from '@/stores/authStore'
import type { WsMessage, WsMessageData } from '@/api/chatSocket'
import type { Message } from '@/types/chat'

function isMathiaMessage(member: string) {
  return member?.toLowerCase() === 'mathia'
}

function wsMessageToFrontend(m: WsMessageData): Message {
  return {
    id: m.id,
    member: m.member,
    content: m.content,
    timestamp: m.timestamp,
    parentId: m.parent_id ?? null,
    isAi: isMathiaMessage(m.member),
    editedAt: m.edited_at ?? null,
    isDeleted: m.is_deleted ?? false,
    audioUrl: m.audio_url ?? undefined,
    voiceTranscript: m.voice_transcript ?? undefined,
    attachments: m.attachments?.map((a) => ({
      id: a.id,
      name: a.name,
      url: a.url,
      type: a.type,
      size: a.size,
      mime: a.mime,
    })),
  }
}

export interface ChatSocketState {
  messages: Message[]
  loadOlder: () => void
  hasMore: boolean
  loadingOlder: boolean
  /** Usernames (excluding self) currently typing in this room. */
  typingUsers: string[]
}

const TYPING_TTL_MS = 3500

export function useChatSocket(roomId: number): ChatSocketState {
  const [messages, setMessages] = useState<Message[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [typingUsers, setTypingUsers] = useState<string[]>([])

  // Refs that must survive re-renders without re-subscribing the socket.
  const oldestIdRef = useRef<number | null>(null)
  const pendingOlderRef = useRef(false)
  const typingTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const loadOlder = useCallback(() => {
    if (pendingOlderRef.current || !oldestIdRef.current) return
    pendingOlderRef.current = true
    setLoadingOlder(true)
    getChatSocket().fetchMessages(oldestIdRef.current)
  }, [])

  useEffect(() => {
    setMessages([])
    setHasMore(false)
    setLoadingOlder(false)
    setTypingUsers([])
    oldestIdRef.current = null
    pendingOlderRef.current = false
    const timers = typingTimersRef.current
    const socket = getChatSocket()
    const selfName = (useAuthStore.getState().username || '').toLowerCase()

    const ingestBatch = (msgs: WsMessageData[], hasMoreResp: boolean, oldestId: number | null) => {
      const mapped = msgs.map(wsMessageToFrontend).reverse() // backend is newest-first
      setHasMore(Boolean(hasMoreResp))
      if (oldestId != null) oldestIdRef.current = oldestId

      if (pendingOlderRef.current) {
        // Paginated "load older" — prepend, de-duping by id.
        pendingOlderRef.current = false
        setLoadingOlder(false)
        setMessages((prev) => {
          const known = new Set(prev.map((m) => m.id))
          const fresh = mapped.filter((m) => !known.has(m.id))
          return [...fresh, ...prev]
        })
      } else {
        setMessages(mapped)
      }
    }

    const clearTyping = (user: string) => {
      setTypingUsers((prev) => prev.filter((u) => u !== user))
      if (timers[user]) {
        clearTimeout(timers[user])
        delete timers[user]
      }
    }

    const appendMessage = (m?: WsMessageData) => {
      if (!m) return
      const next = wsMessageToFrontend(m)
      if (!next.isAi) clearTyping(next.member) // a sent message ends their "typing"
      setMessages((prev) => {
        if (prev.some((msg) => msg.id === next.id)) return prev
        const last = prev[prev.length - 1]
        if ((last?.isStreaming || last?.isTemp) && next.isAi) {
          return [...prev.slice(0, -1), next]
        }
        return [...prev, next]
      })
    }

    const appendStreamChunk = (chunk?: string, isFinal = false) => {
      if (!chunk && !isFinal) return
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last && last.isStreaming) {
          const updated: Message = {
            ...last,
            content: `${last.content}${chunk ?? ''}`,
            isStreaming: !isFinal,
            isTemp: true,
          }
          return [...prev.slice(0, -1), updated]
        }
        if (isFinal && !chunk) return prev
        const streamMsg: Message = {
          id: Date.now(),
          member: 'mathia',
          content: chunk ?? '',
          timestamp: new Date().toISOString(),
          parentId: null,
          isAi: true,
          isStreaming: !isFinal,
          isTemp: true,
        }
        return [...prev, streamMsg]
      })
    }

    const handleTyping = (from?: string) => {
      if (!from) return
      if (from.toLowerCase() === selfName) return // ignore our own echo
      setTypingUsers((prev) => (prev.includes(from) ? prev : [...prev, from]))
      if (timers[from]) clearTimeout(timers[from])
      timers[from] = setTimeout(() => clearTyping(from), TYPING_TTL_MS)
    }

    const unsub1 = socket.on('connected', () => socket.fetchMessages())
    const unsub2 = socket.on('*', (msg: WsMessage) => {
      if (msg.command === 'messages') {
        const msgs = (msg.messages as WsMessageData[] | undefined) ?? []
        ingestBatch(msgs, Boolean(msg.has_more), (msg.oldest_id as number | null) ?? null)
      }
      if (msg.command === 'new_message' || msg.command === 'ai_message' || msg.command === 'ai_message_saved') {
        appendMessage(msg.message as WsMessageData | undefined)
      }
      if (msg.command === 'ai_stream') {
        appendStreamChunk(msg.chunk as string | undefined, Boolean(msg.is_final))
      }
      if (msg.command === 'typing') {
        handleTyping(msg.from as string | undefined)
      }
      if (msg.command === 'message_edited') {
        const edited = msg.message as WsMessageData | WsMessage | undefined
        if (edited && typeof (edited as WsMessageData).id === 'number') {
          const m = edited as WsMessageData
          setMessages((prev) => prev.map(p =>
            p.id === m.id ? { ...p, content: m.content, editedAt: m.edited_at ?? null } : p,
          ))
        }
      }
      if (msg.command === 'message_deleted') {
        const mid = msg.message_id as number | undefined
        if (mid) {
          setMessages((prev) => prev.map(p =>
            p.id === mid ? { ...p, isDeleted: true, content: '' } : p,
          ))
        }
      }
    })

    const username = useAuthStore.getState().username || 'alex'
    socket.connect(roomId, username)

    return () => {
      unsub1()
      unsub2()
      Object.values(timers).forEach(clearTimeout)
      typingTimersRef.current = {}
      socket.disconnect()
    }
  }, [roomId])

  return { messages, loadOlder, hasMore, loadingOlder, typingUsers }
}
