export interface WsMessage {
  command: string
  [key: string]: unknown
}

export interface WsAttachmentData {
  id: number
  name: string
  url: string
  type: 'image' | 'video' | 'audio' | 'file' | 'document'
  size: number
  mime?: string
  ai_readable?: boolean
  ai_document_id?: number | null
}

export interface WsMessageData {
  id: number
  member: string
  content: string
  timestamp: string
  parent_id: number | null
  edited_at?: string | null
  is_deleted?: boolean
  is_voice?: boolean
  audio_url?: string | null
  voice_transcript?: string | null
  has_ai_voice?: boolean
  attachments?: WsAttachmentData[]
}

type MessageHandler = (data: WsMessage) => void

const TIMEOUT = 30000

export class ChatSocket {
  private ws: WebSocket | null = null
  private roomId: number | null = null
  private username = ''
  private handlers: Map<string, Set<MessageHandler>> = new Map()
  private pending: Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }> = new Map()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private url = ''

  constructor() {}

  connect(roomId: number, username: string) {
    this.disconnect()
    this.roomId = roomId
    this.username = username

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const token = localStorage.getItem('mathia-auth-token')
    const tokenParam = token ? `?token=${token}` : ''
    this.url = `${protocol}//${host}/ws/chat/${roomId}/${tokenParam}`

    this.createSocket()

    // If no token yet, retry when auth completes
    if (!token) {
      const checkInterval = setInterval(() => {
        const t = localStorage.getItem('mathia-auth-token')
        if (t && this.ws?.readyState !== WebSocket.OPEN) {
          clearInterval(checkInterval)
          this.disconnect()
          this.url = `${protocol}//${host}/ws/chat/${roomId}/?token=${t}`
          this.createSocket()
        }
      }, 1000)
      setTimeout(() => clearInterval(checkInterval), 10000)
    }
  }

  private createSocket() {
    if (!this.roomId) return

    this.ws = new WebSocket(this.url)

    this.ws.onopen = () => {
      this.emit('connected', { roomId: this.roomId })
    }

    this.ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data)
        const command = msg.command

        // Handle promises (request-response pattern)
        const pending = this.pending.get(command)
        if (pending) {
          this.pending.delete(command)
          pending.resolve(msg)
        }

        // Broadcast to registered handlers
        const cmdHandlers = this.handlers.get(command)
        if (cmdHandlers) {
          cmdHandlers.forEach(h => h(msg))
        }

        // Also emit to wildcard handlers
        const allHandlers = this.handlers.get('*')
        if (allHandlers) {
          allHandlers.forEach(h => h(msg))
        }
      } catch {
        // ignore parse errors
      }
    }

    this.ws.onclose = () => {
      this.emit('disconnected', { roomId: this.roomId })
      this.scheduleReconnect()
    }

    this.ws.onerror = () => {
      // onclose will fire after this
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.roomId) {
        this.createSocket()
      }
    }, 3000)
  }

  send(command: string, payload: Record<string, unknown> = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this.ws.send(JSON.stringify({ command, ...payload }))
  }

  sendMessage(content: string, parentId?: number | null) {
    this.send('new_message', {
      from: this.username,
      chatid: String(this.roomId),
      message: content,
      reply_to: parentId ?? null,
    })
  }

  fetchMessages(beforeId?: number) {
    this.send('fetch_messages', {
      chatid: String(this.roomId),
      ...(beforeId ? { before_id: beforeId } : {}),
    })
  }

  sendTyping() {
    this.send('typing', { from: this.username })
  }

  editMessage(messageId: number, content: string) {
    this.send('edit_message', {
      from: this.username,
      chatid: String(this.roomId),
      message_id: messageId,
      content,
    })
  }

  deleteMessage(messageId: number) {
    this.send('delete_message', {
      from: this.username,
      chatid: String(this.roomId),
      message_id: messageId,
    })
  }

  request<T = unknown>(command: string, payload: Record<string, unknown> = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'))
        return
      }
      this.pending.set(command, { resolve: resolve as (v: unknown) => void, reject })
      this.ws.send(JSON.stringify({ command, ...payload }))
      setTimeout(() => {
        if (this.pending.has(command)) {
          this.pending.delete(command)
          reject(new Error(`Timeout waiting for ${command}`))
        }
      }, TIMEOUT)
    })
  }

  on(command: string, handler: MessageHandler) {
    if (!this.handlers.has(command)) {
      this.handlers.set(command, new Set())
    }
    this.handlers.get(command)!.add(handler)
    return () => {
      this.handlers.get(command)?.delete(handler)
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.onclose = null
      this.ws.close()
      this.ws = null
    }
    this.pending.clear()
    this.roomId = null
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN
  }

  private emit(event: string, data: unknown) {
    const handlers = this.handlers.get(event)
    if (handlers) {
      handlers.forEach(h => h({ command: event, ...(data as Record<string, unknown>) }))
    }
  }
}

let instance: ChatSocket | null = null

export function getChatSocket(): ChatSocket {
  if (!instance) {
    instance = new ChatSocket()
  }
  return instance
}
