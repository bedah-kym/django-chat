import { useParams } from 'react-router-dom'
import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as Tooltip from '@radix-ui/react-tooltip'
import { Search, PanelRightOpen, PanelRightClose, ChevronDown, Download, UserPlus, X } from 'lucide-react'
import { apiRequest } from '@/api/client'
import { toast } from 'sonner'
import { useChatStore } from '@/stores/chatStore'
import { useChatSocket } from '@/hooks/useChatSocket'
import { fetchContacts, fetchActionReceipts, fetchRoomContext, fetchLinkedRooms, markRoomRead } from '@/api/chat'
import type { Contact, ActionReceipt, Note } from '@/types/chat'
import { ContextPanel } from './components/ContextPanel'
import { MarkdownRenderer } from './components/MarkdownRenderer'
import { ThinkingBlock } from './components/ThinkingBlock'
import { ToolCallDisplay } from './components/ToolCallDisplay'
import { MessageActions } from './components/MessageActions'
import { TypingIndicator } from './components/TypingIndicator'
import { ReplyReference } from './components/ReplyReference'
import { PresenceDot } from './components/PresenceDot'
import { HistoryLoader } from './components/HistoryLoader'
import { ChatInput } from './components/ChatInput'
import { MessageSearch } from './components/MessageSearch'
import { VoiceMessage } from './components/VoiceMessage'
import { MathiaAvatar } from '@/components/ui/MathiaAvatar'
import { formatDate, formatTime } from '@/utils/format'
import styles from './ChatPage.module.css'

export function ChatPage() {
  const { roomId: roomIdParam } = useParams<{ roomId: string }>()
  const roomId = Number(roomIdParam)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [hoveredMsg, setHoveredMsg] = useState<number | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [actionReceipts, setActionReceipts] = useState<ActionReceipt[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [summary, setSummary] = useState('')
  const [linkedRooms, setLinkedRooms] = useState<{ id: number; name: string }[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const prevMsgCountRef = useRef(0)
  const nearBottomRef = useRef(true)
  const messageAreaRef = useRef<HTMLDivElement>(null)

  const rooms = useChatStore((s) => s.rooms)
  const setActiveRoom = useChatStore((s) => s.setActiveRoom)
  const searchOpen = useChatStore((s) => s.searchOpen)
  const setSearchOpen = useChatStore((s) => s.setSearchOpen)
  const searchResults = useChatStore((s) => s.searchResults)
  const searchActiveIndex = useChatStore((s) => s.searchActiveIndex)
  const activeResultId = searchResults[searchActiveIndex] ?? null
  const resultSet = new Set(searchResults)

  const room = rooms.find((candidate) => candidate.id === roomId)
  const allMessages = useChatSocket(roomId)

  useEffect(() => {
    if (roomId) {
      setActiveRoom(roomId)
      // Tell the backend this room is now read (clears unread on the server too,
      // not just locally).
      markRoomRead(roomId).catch(() => {})
    }
    setContacts([])
    setActionReceipts([])
    setNotes([])
    setSummary('')
    setLinkedRooms([])
  }, [roomId, setActiveRoom])

  useEffect(() => {
    if (roomId && isPanelOpen) {
      fetchContacts().then(setContacts).catch(() => {})
      fetchActionReceipts(roomId).then(setActionReceipts).catch(() => {})
      fetchRoomContext(roomId)
        .then(ctx => { setNotes(ctx.notes); setSummary(ctx.summary) })
        .catch(() => {})
      fetchLinkedRooms(roomId).then(res => setLinkedRooms(res.linked ?? [])).catch(() => {})
    }
  }, [roomId, isPanelOpen])

  // Auto-follow new content. Reacts to message-count change *and* to the
  // streaming message's content extending, so the view tracks the AI's reply
  // as it types. Skips when the user has scrolled up — never yanks them back.
  const lastMsg = allMessages[allMessages.length - 1]
  const lastContentLen = lastMsg?.content?.length ?? 0
  const lastIsStreaming = Boolean(lastMsg?.isStreaming)
  useLayoutEffect(() => {
    const element = messageAreaRef.current
    if (!element) return
    if (!nearBottomRef.current) return
    element.scrollTop = element.scrollHeight
  }, [allMessages.length, lastContentLen, lastIsStreaming])

  // Scroll the active search match into view as the user steps through results
  useEffect(() => {
    if (activeResultId == null) return
    document.getElementById(`msg-${activeResultId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [activeResultId])

  // Reset the thinking indicator when switching rooms
  useEffect(() => {
    setIsThinking(false)
    prevMsgCountRef.current = 0
  }, [roomId])

  // Show "Mathia is thinking…" only when the user sends a message that targets
  // the AI, and clear it the instant an AI message/chunk arrives. Driven off
  // incremental message growth so it never triggers on initial load/refresh.
  useEffect(() => {
    const prev = prevMsgCountRef.current
    const curr = allMessages.length
    prevMsgCountRef.current = curr
    if (curr === 0 || prev === 0 || curr <= prev) return
    const last = allMessages[curr - 1]
    if (!last) return
    if (last.isAi) {
      setIsThinking(false)
    } else if (room?.isAiRoom || last.content.trim().toLowerCase().startsWith('@mathia')) {
      setIsThinking(true)
    }
  }, [allMessages, room])

  // Safety net: never let the thinking indicator hang forever
  useEffect(() => {
    if (!isThinking) return
    const timer = setTimeout(() => setIsThinking(false), 45000)
    return () => clearTimeout(timer)
  }, [isThinking])

  const handleExport = () => {
    // The export view renders an HTML date-range form (and POSTs back the
    // download). Open in a new tab so the user can pick a range; if they're
    // not logged into the Django session it will route them through login.
    window.open(`/chatbot/rooms/${roomId}/export/`, '_blank', 'noopener')
  }

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase()
    if (!email || inviting) return
    setInviting(true)
    try {
      const res = await apiRequest<{ status: string; message?: string }>('/chatbot/invite/', {
        method: 'POST',
        body: JSON.stringify({ room_id: roomId, email }),
      })
      if (res.status === 'success') {
        toast.success(res.message || 'Invited')
        setInviteEmail('')
        setInviteOpen(false)
      } else {
        toast.error(res.message || 'Could not invite')
      }
    } catch {
      toast.error('Invite failed')
    } finally {
      setInviting(false)
    }
  }

  const isFirstInGroup = (index: number) =>
    index === 0 || allMessages[index - 1]!.member !== allMessages[index]!.member

  const getParentMessage = (parentId: number | null) =>
    parentId ? allMessages.find((message) => message.id === parentId) : undefined

  if (!room) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 14 }}>
        Room not found
      </div>
    )
  }

  const onlineCount = room.participants.filter((participant) => participant.isOnline).length

  return (
    <section className={styles.chatPage} aria-label={`${room.displayName} chat workspace`}>
      {searchOpen && <MessageSearch onClose={() => setSearchOpen(false)} />}

      <header className={styles.chatHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.roomAvatar}>
            {room.isAiRoom ? <MathiaAvatar size={40} /> : room.participants[0]?.displayName?.[0] || '?'}
          </div>
          <div className={styles.headerInfo}>
            <h1 className={styles.roomName}>{room.displayName}</h1>
            <div className={styles.headerSub}>
              <PresenceDot isOnline={room.isAiRoom || onlineCount > 0} size={7} />
              <span className={styles.subText}>
                {onlineCount} online | {room.participants.length} members
              </span>
            </div>
          </div>
        </div>
        <div className={styles.headerActions}>
          <Tooltip.Provider>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  className={styles.actionBtn}
                  onClick={() => setSearchOpen(!searchOpen)}
                  aria-label="Search messages"
                >
                  <Search size={16} />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className={styles.tooltip} side="bottom">
                  Search
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>

          {!room.isAiRoom && (
            <button
              className={styles.actionBtn}
              onClick={() => setInviteOpen(true)}
              aria-label="Invite user"
              title="Invite user"
            >
              <UserPlus size={16} />
            </button>
          )}

          <button
            className={styles.actionBtn}
            onClick={handleExport}
            aria-label="Export chat"
            title="Export chat"
          >
            <Download size={16} />
          </button>

          <button
            className={styles.actionBtn}
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            aria-label={isPanelOpen ? 'Close context panel' : 'Open context panel'}
          >
            {isPanelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {inviteOpen && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => !inviting && setInviteOpen(false)}
          >
            <motion.div
              className={styles.modalCard}
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Invite to {room.displayName}</h3>
                <button className={styles.modalClose} onClick={() => setInviteOpen(false)} disabled={inviting} aria-label="Close">
                  <X size={16} />
                </button>
              </div>
              <input
                autoFocus
                className={styles.modalInput}
                type="email"
                placeholder="email@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleInvite()
                  if (e.key === 'Escape') setInviteOpen(false)
                }}
              />
              <div className={styles.modalActions}>
                <button className={styles.modalCancel} onClick={() => setInviteOpen(false)} disabled={inviting}>
                  Cancel
                </button>
                <button className={styles.modalSubmit} onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                  {inviting ? 'Inviting…' : 'Send invite'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={styles.chatBody}>
        <div
          className={styles.messageArea}
          ref={messageAreaRef}
          onScroll={(event) => {
            const element = event.currentTarget
            const distance = element.scrollHeight - element.scrollTop - element.clientHeight
            nearBottomRef.current = distance < 120
            setShowScrollBtn(distance > 200)
          }}
        >
          <HistoryLoader isLoading={false} hasMore={false} onLoadMore={() => {}} />

          {allMessages.length === 0 && (
            <div className={styles.emptyMessages}>
              <p>No messages yet. Start the conversation.</p>
            </div>
          )}

          {allMessages.map((msg, index) => {
            const showDate =
              index === 0 ||
              new Date(msg.timestamp).toDateString() !== new Date(allMessages[index - 1]!.timestamp).toDateString()
            const firstInGroup = isFirstInGroup(index)
            const isOwn = msg.member === 'alex'
            const parentMsg = getParentMessage(msg.parentId)

            return (
              <div key={msg.id}>
                {showDate ? (
                  <div className={styles.dateSeparator}>
                    <span>{formatDate(msg.timestamp, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                  </div>
                ) : null}

                <motion.div
                  id={`msg-${msg.id}`}
                  className={`${styles.messageRow} ${isOwn ? styles.ownMessage : ''}`}
                  initial={false}
                  onMouseEnter={() => setHoveredMsg(msg.id)}
                  onMouseLeave={() => setHoveredMsg(null)}
                >
                  {firstInGroup && !isOwn ? (
                    <div className={styles.avatarCol}>
                      {msg.isAi ? (
                        <MathiaAvatar size={32} />
                      ) : (
                        <div className={styles.userAvatar}>
                          {room.participants.find((p) => p.username === msg.member)?.displayName?.[0] ?? '?'}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={styles.avatarCol} />
                  )}

                  <div className={`${styles.msgContent} ${isOwn ? styles.ownContent : ''} ${resultSet.has(msg.id) ? styles.searchHit : ''} ${activeResultId === msg.id ? styles.searchActiveHit : ''}`}>
                    {firstInGroup && !isOwn ? (
                      <div className={styles.msgHeader}>
                        <span className={styles.senderName}>
                          {msg.isAi ? 'Mathia' : room.participants.find((p) => p.username === msg.member)?.displayName ?? msg.member}
                        </span>
                        {msg.isAi ? <span className={styles.aiBadge}>AI</span> : null}
                        <span className={styles.msgTime}>{formatTime(msg.timestamp)}</span>
                      </div>
                    ) : null}

                    {parentMsg ? <ReplyReference parentMessage={parentMsg} /> : null}

                    {msg.thinking ? <ThinkingBlock content={msg.thinking} durationMs={msg.thinkingDurationMs} isActive={msg.isStreaming} /> : null}
                    {msg.toolCalls?.map((tc, i) => <ToolCallDisplay key={i} toolName={tc.name} status={tc.status} result={tc.result} />)}

                    {msg.audioUrl ? (
                      <VoiceMessage audioUrl={msg.audioUrl} transcript={msg.voiceTranscript} />
                    ) : msg.content ? (
                      msg.isAi ? (
                        <MarkdownRenderer content={msg.content} />
                      ) : (
                        <div className={styles.messageText}>{msg.content}</div>
                      )
                    ) : null}

                    {msg.isStreaming ? <span className={styles.streamingCursor} /> : null}

                    {hoveredMsg === msg.id && !msg.isStreaming ? (
                      <div className={styles.msgActions}><MessageActions content={msg.content} isAi={msg.isAi} visible={true} roomId={roomId} messageId={msg.id} /></div>
                    ) : null}
                  </div>

                  {isOwn ? <div className={styles.timeCol}><span>{formatTime(msg.timestamp)}</span></div> : null}
                </motion.div>
              </div>
            )
          })}

          <TypingIndicator isThinking={isThinking} />
        </div>

        {showScrollBtn ? (
          <button className={styles.scrollBtn} onClick={() => {
            if (messageAreaRef.current) {
              messageAreaRef.current.scrollTop = messageAreaRef.current.scrollHeight
              nearBottomRef.current = true
            }
          }}>
            <ChevronDown size={18} />
          </button>
        ) : null}

        <AnimatePresence>
          {isPanelOpen ? (
            <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 'var(--context-panel-width)', opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.25 }} className={styles.contextWrap}>
              <ContextPanel
                room={room}
                contacts={contacts}
                notes={notes}
                actionReceipts={actionReceipts}
                summary={summary}
                linkedRooms={linkedRooms}
                onClose={() => setIsPanelOpen(false)}
                onNotesChanged={() => {
                  fetchRoomContext(roomId)
                    .then(ctx => { setNotes(ctx.notes); setSummary(ctx.summary) })
                    .catch(() => {})
                }}
                onContactsChanged={() => {
                  fetchContacts().then(setContacts).catch(() => {})
                }}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <ChatInput roomId={roomId} participants={room.participants} />
    </section>
  )
}
