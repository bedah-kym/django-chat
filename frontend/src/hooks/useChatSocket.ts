import { useEffect, useState } from 'react'
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
  }
}

export function useChatSocket(roomId: number) {
  const [messages, setMessages] = useState<Message[]>([])

  useEffect(() => {
    setMessages([])
    const socket = getChatSocket()

    const addMessages = (msgs: WsMessageData[]) => {
      const mapped = msgs.map(wsMessageToFrontend)
      // Backend returns newest-first; reverse to oldest-first for display
      setMessages(mapped.reverse())
    }

    const appendMessage = (m?: WsMessageData) => {
      if (!m) return
      const next = wsMessageToFrontend(m)
      setMessages(prev => {
        if (prev.some(msg => msg.id === next.id)) return prev

        const last = prev[prev.length - 1]
        if ((last?.isStreaming || last?.isTemp) && next.isAi) {
          return [...prev.slice(0, -1), next]
        }

        return [...prev, next]
      })
    }

    const appendStreamChunk = (chunk?: string, isFinal = false) => {
      if (!chunk && !isFinal) return
      setMessages(prev => {
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

        if (isFinal && !chunk) {
          return prev
        }

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

    const unsub1 = socket.on('connected', () => socket.fetchMessages())
    const unsub2 = socket.on('*', (msg: WsMessage) => {
      if (msg.command === 'messages') {
        const msgs = msg.messages as WsMessageData[] | undefined
        if (msgs?.length) addMessages(msgs)
      }
      if (msg.command === 'new_message' || msg.command === 'ai_message' || msg.command === 'ai_message_saved') {
        appendMessage(msg.message as WsMessageData | undefined)
      }
      if (msg.command === 'ai_stream') {
        appendStreamChunk(msg.chunk as string | undefined, Boolean(msg.is_final))
      }
    })

    const username = useAuthStore.getState().username || 'alex'
    socket.connect(roomId, username)

    return () => { unsub1(); unsub2(); socket.disconnect() }
  }, [roomId])

  return messages
}
