import { useParams } from 'react-router-dom'
import { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as Tooltip from '@radix-ui/react-tooltip'
import { Search, PanelRightOpen, PanelRightClose, ChevronDown, Download, UserPlus, X, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { useChatStore } from '@/stores/chatStore'
import { useAuthStore } from '@/stores/authStore'
import { useChatSocket } from '@/hooks/useChatSocket'
import { fetchContacts, fetchActionReceipts, fetchRoomContext, fetchLinkedRooms, markRoomRead, inviteToRoom } from '@/api/chat'
import type { Contact, ActionReceipt, Note } from '@/types/chat'
import type { MemoryFact, MemoryEpisode } from '@/api/chat'
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
  const [linkableRooms, setLinkableRooms] = useState<{ id: number; name: string }[]>([])
  const [memoryFacts, setMemoryFacts] = useState<MemoryFact[]>([])
  const [memoryPreferences, setMemoryPreferences] = useState<MemoryFact[]>([])
  const [memoryEpisodes, setMemoryEpisodes] = useState<MemoryEpisode[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [editingMsgId, setEditingMsgId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [deletingMsgId, setDeletingMsgId] = useState<number | null>(null)
  const prevMsgCountRef = useRef(0)
  const nearBottomRef = useRef(true)
  const messageAreaRef = useRef<HTMLDivElement>(null)

  const rooms = useChatStore((s) => s.rooms)
  const setActiveRoom = useChatStore((s) => s.setActiveRoom)
  const setReplyingTo = useChatStore((s) => s.setReplyingTo)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const editMessage = useChatStore((s) => s.editMessage)
  const deleteMessage = useChatStore((s) => s.deleteMessage)
  const searchOpen = useChatStore((s) => s.searchOpen)
  const setSearchOpen = useChatStore((s) => s.setSearchOpen)
  const searchResults = useChatStore((s) => s.searchResults)
  const searchActiveIndex = useChatStore((s) => s.searchActiveIndex)
  const activeResultId = searchResults[searchActiveIndex] ?? null
  const resultSet = useMemo(() => new Set(searchResults), [searchResults])

  const username = useAuthStore((s) => s.username)
  const room = useMemo(() => rooms.find((candidate) => candidate.id === roomId), [rooms, roomId])
  const { messages: allMessages, loadOlder, hasMore, loadingOlder, typingUsers } = useChatSocket(roomId)

  // Optimistic pending bubbles are inserted into the store by sendMessage; merge
  // them in for display until the WS echoes the real (server-id'd) message back.
  const roomMessages = useChatStore((s) => s.messagesByRoom[roomId])
  const displayMessages = useMemo(() => {
    const pending = (roomMessages ?? []).filter((m) => m.isPending)
    if (!pending.length) return allMessages
    const echoed = new Set(allMessages.map((m) => `${m.member}|${m.content}`))
    const fresh = pending.filter((m) => !echoed.has(`${m.member}|${m.content}`))
    return fresh.length ? [...allMessages, ...fresh] : allMessages
  }, [allMessages, roomMessages])

  const typingNames = useMemo(() =>
    typingUsers
      .filter(u => u !== username)
      .map(u => room?.participants.find(p => p.username === u)?.displayName || u),
    [typingUsers, username, room],
  )

  const getParentMessage = useCallback((parentId: number | null) => {
    if (!parentId) return undefined
    return allMessages.find(m => m.id === parentId)
  }, [allMessages])

  // Preserve scroll position when older messages are prepended.
  const prevScrollHeightRef = useRef(0)
  const restoringScrollRef = useRef(false)
  const handleLoadOlder = () => {
    const el = messageAreaRef.current
    if (el) {
      prevScrollHeightRef.current = el.scrollHeight
      restoringScrollRef.current = true
    }
    loadOlder()
  }

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
    setLinkableRooms([])
    setMemoryFacts([])
    setMemoryPreferences([])
    setMemoryEpisodes([])
  }, [roomId, setActiveRoom])

  useEffect(() => {
    if (roomId && isPanelOpen) {
      fetchContacts().then(setContacts).catch(() => {})
      fetchActionReceipts(roomId).then(setActionReceipts).catch(() => {})
      fetchRoomContext(roomId)
        .then(ctx => {
          setNotes(ctx.notes)
          setSummary(ctx.summary)
          setMemoryFacts(ctx.memoryFacts)
          setMemoryPreferences(ctx.memoryPreferences)
          setMemoryEpisodes(ctx.memoryEpisodes)
        })
        .catch(() => {})
      fetchLinkedRooms(roomId)
        .then(res => {
          setLinkedRooms(res.linked ?? [])
          setLinkableRooms(res.linkable ?? [])
        })
        .catch(() => {})
    }
  }, [roomId, isPanelOpen])

  // Auto-follow new content. Reacts to message-count change *and* to the
  // streaming message's content extending, so the view tracks the AI's reply
  // as it types. Skips when the user has scrolled up — never yanks them back.
  const lastMsg = displayMessages[displayMessages.length - 1]
  const lastContentLen = lastMsg?.content?.length ?? 0
  const lastIsStreaming = Boolean(lastMsg?.isStreaming)
  useLayoutEffect(() => {
    const element = messageAreaRef.current
    if (!element) return
    if (!nearBottomRef.current) return
    element.scrollTop = element.scrollHeight
  }, [displayMessages.length, lastContentLen, lastIsStreaming])

  // After prepending older messages, keep the previously-visible message put
  // (otherwise the viewport jumps to the top of the freshly-loaded batch).
  useLayoutEffect(() => {
    const el = messageAreaRef.current
    if (!el || !restoringScrollRef.current) return
    el.scrollTop = el.scrollHeight - prevScrollHeightRef.current
    restoringScrollRef.current = false
  }, [allMessages.length])

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

  // Mirror the live messages from useChatSocket into the Zustand store so
  // consumers that need them (e.g. message search, which filters from
  // `messagesByRoom[activeRoomId]`) see real data. The hook keeps its own copy
  // to avoid the WS-driven infinite render loop noted in the journal — this
  // sync runs at commit time so it doesn't reintroduce that cycle.
  useEffect(() => {
    if (!roomId) return
    useChatStore.setState(s => {
      const storeMsgs = s.messagesByRoom[roomId] ?? []
      const pending = storeMsgs.filter(m =>
        m.isPending && !allMessages.some(rm => rm.content === m.content && rm.member === m.member),
      )
      const merged = [...allMessages, ...pending]
      return { messagesByRoom: { ...s.messagesByRoom, [roomId]: merged } }
    })
    const q = useChatStore.getState().searchQuery
    if (q) useChatStore.getState().setSearchQuery(q)
  }, [roomId, allMessages])

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
      const res = await inviteToRoom(roomId, email)
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

  const handleEditMessage = (msgId: number, currentContent: string) => {
    setEditingMsgId(msgId)
    setEditDraft(currentContent)
  }

  const handleSaveEdit = () => {
    if (!editingMsgId || !editDraft.trim()) return
    editMessage(roomId, editingMsgId, editDraft.trim())
    setEditingMsgId(null)
    setEditDraft('')
  }

  const handleCancelEdit = () => {
    setEditingMsgId(null)
    setEditDraft('')
  }

  const handleDeleteMessage = (msgId: number) => {
    if (deletingMsgId === msgId) {
      deleteMessage(roomId, msgId)
      setDeletingMsgId(null)
    } else {
      setDeletingMsgId(msgId)
    }
  }

  const handleCancelDelete = () => {
    setDeletingMsgId(null)
  }

  const isFirstInGroup = (index: number) =>
    index === 0 || displayMessages[index - 1]!.member !== displayMessages[index]!.member

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
          role="log"
          aria-live="polite"
          aria-atomic="false"
          onScroll={(event) => {
            const element = event.currentTarget
            const distance = element.scrollHeight - element.scrollTop - element.clientHeight
            nearBottomRef.current = distance < 120
            setShowScrollBtn(distance > 200)
          }}
        >
          <HistoryLoader isLoading={loadingOlder} hasMore={hasMore} onLoadMore={handleLoadOlder} />

          {allMessages.length === 0 && (
            <div className={styles.emptyMessages}>
              <p>No messages yet. Start the conversation.</p>
            </div>
          )}

          {displayMessages.map((msg, index) => {
            const showDate =
              index === 0 ||
              new Date(msg.timestamp).toDateString() !== new Date(displayMessages[index - 1]!.timestamp).toDateString()
            const firstInGroup = isFirstInGroup(index)
            const isOwn = msg.member === username
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

                  <div className={`${styles.msgContent} ${isOwn ? styles.ownContent : ''} ${msg.isPending ? styles.pendingContent : ''} ${resultSet.has(msg.id) ? styles.searchHit : ''} ${activeResultId === msg.id ? styles.searchActiveHit : ''}`}>
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

                    {msg.attachments?.length ? (
                      <div className={styles.attachmentChips}>
                        {msg.attachments.map(a => (
                          <a
                            key={a.id}
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.attachmentChip}
                          >
                            <FileText size={12} />
                            <span>{a.name}</span>
                            <span className={styles.attachmentSize}>{(a.size / 1024).toFixed(0)}KB</span>
                          </a>
                        ))}
                      </div>
                    ) : null}

                    {msg.audioUrl ? (
                      <VoiceMessage audioUrl={msg.audioUrl} transcript={msg.voiceTranscript} />
                    ) : editingMsgId === msg.id ? (
                      <div className={styles.editArea}>
                        <textarea
                          className={styles.editInput}
                          value={editDraft}
                          onChange={e => setEditDraft(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit() }
                            if (e.key === 'Escape') handleCancelEdit()
                          }}
                          autoFocus
                          rows={2}
                        />
                        <div className={styles.editActions}>
                          <button className={styles.editCancel} onClick={handleCancelEdit}>Cancel</button>
                          <button className={styles.editSave} onClick={handleSaveEdit}>Save</button>
                        </div>
                      </div>
                    ) : msg.isDeleted ? (
                      <span className={styles.deletedTombstone}>This message was deleted</span>
                    ) : msg.content ? (
                      msg.isAi ? (
                        <MarkdownRenderer content={msg.content} />
                      ) : (
                        <div className={styles.messageText}>{msg.content}</div>
                      )
                    ) : null}

                    {msg.editedAt && !msg.isDeleted ? (
                      <span className={styles.editedTag}>edited</span>
                    ) : null}

                    {msg.isStreaming ? <span className={styles.streamingCursor} /> : null}

                    {deletingMsgId === msg.id ? (
                      <div className={styles.deleteConfirm}>
                        <span>Delete this message?</span>
                        <button className={styles.deleteConfirmBtn} onClick={() => handleDeleteMessage(msg.id)}>Delete</button>
                        <button className={styles.deleteCancelBtn} onClick={handleCancelDelete}>Cancel</button>
                      </div>
                    ) : null}

                    {hoveredMsg === msg.id && !msg.isStreaming && editingMsgId !== msg.id && deletingMsgId !== msg.id ? (
                      <div className={styles.msgActions}><MessageActions
                        content={msg.content}
                        isAi={msg.isAi}
                        visible={true}
                        roomId={roomId}
                        messageId={msg.id}
                        onReply={() => setReplyingTo(msg)}
                        onEdit={!msg.isAi ? () => handleEditMessage(msg.id, msg.content) : undefined}
                        onDelete={!msg.isAi ? () => handleDeleteMessage(msg.id) : undefined}
                        onRegenerate={msg.isAi ? () => {
                          for (let i = index - 1; i >= 0; i--) {
                            if (!allMessages[i]!.isAi) { sendMessage(roomId, allMessages[i]!.content); break }
                          }
                        } : undefined}
                      /></div>
                    ) : null}
                  </div>

                  {isOwn ? <div className={styles.timeCol}><span>{formatTime(msg.timestamp)}</span></div> : null}
                </motion.div>
              </div>
            )
          })}

          <TypingIndicator isThinking={isThinking} typingUsers={typingNames} />
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
                linkableRooms={linkableRooms}
                memoryFacts={memoryFacts}
                memoryPreferences={memoryPreferences}
                memoryEpisodes={memoryEpisodes}
                onClose={() => setIsPanelOpen(false)}
                onNotesChanged={() => {
                  fetchRoomContext(roomId)
                    .then(ctx => {
                      setNotes(ctx.notes)
                      setSummary(ctx.summary)
                      setMemoryFacts(ctx.memoryFacts)
                      setMemoryPreferences(ctx.memoryPreferences)
                      setMemoryEpisodes(ctx.memoryEpisodes)
                    })
                    .catch(() => {})
                }}
                onContactsChanged={() => {
                  fetchContacts().then(setContacts).catch(() => {})
                }}
                onLinksChanged={() => {
                  fetchLinkedRooms(roomId)
                    .then(res => {
                      setLinkedRooms(res.linked ?? [])
                      setLinkableRooms(res.linkable ?? [])
                    })
                    .catch(() => {})
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
