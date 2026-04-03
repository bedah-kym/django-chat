import { useParams } from 'react-router-dom'
import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as Tooltip from '@radix-ui/react-tooltip'
import { Search, PanelRightOpen, PanelRightClose, Sparkles, ChevronDown } from 'lucide-react'
import { useChatStore } from '@/stores/chatStore'
import { mockContacts, mockNotes, mockActionReceipts } from '@/mocks/chat'
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
import styles from './ChatPage.module.css'

export function ChatPage() {
  const { roomId: roomIdParam } = useParams<{ roomId: string }>()
  const roomId = Number(roomIdParam)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [hoveredMsg, setHoveredMsg] = useState<number | null>(null)
  const messageAreaRef = useRef<HTMLDivElement>(null)
  const prevScrollHeightRef = useRef(0)

  const rooms = useChatStore(s => s.rooms)
  const messages = useChatStore(s => s.messagesByRoom[roomId] ?? [])
  const setActiveRoom = useChatStore(s => s.setActiveRoom)
  const historyState = useChatStore(s => s.historyState[roomId])
  const searchOpen = useChatStore(s => s.searchOpen)
  const setSearchOpen = useChatStore(s => s.setSearchOpen)
  const searchResults = useChatStore(s => s.searchResults)
  const searchActiveIndex = useChatStore(s => s.searchActiveIndex)
  const loadOlderMessages = useChatStore(s => s.loadOlderMessages)

  const room = rooms.find(r => r.id === roomId)

  // Mark room as read on enter
  useEffect(() => {
    if (roomId) setActiveRoom(roomId)
  }, [roomId, setActiveRoom])

  // Ctrl+F to open search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setSearchOpen(!searchOpen)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [searchOpen, setSearchOpen])

  // Scroll position lock for pagination
  useLayoutEffect(() => {
    const el = messageAreaRef.current
    if (!el) return
    if (prevScrollHeightRef.current > 0 && el.scrollHeight > prevScrollHeightRef.current) {
      el.scrollTop += el.scrollHeight - prevScrollHeightRef.current
    }
    prevScrollHeightRef.current = el.scrollHeight
  }, [messages.length])

  const handleLoadMore = useCallback(() => {
    if (messageAreaRef.current) {
      prevScrollHeightRef.current = messageAreaRef.current.scrollHeight
    }
    loadOlderMessages(roomId)
  }, [roomId, loadOlderMessages])

  if (!room) {
    return <div className={styles.empty}>Room not found</div>
  }

  const onlineCount = room.participants.filter(p => p.isOnline).length
  const allMessages = messages

  // Message grouping
  const isFirstInGroup = (i: number) =>
    i === 0 || allMessages[i - 1]!.member !== allMessages[i]!.member
  const isLastInGroup = (i: number) =>
    i === allMessages.length - 1 || allMessages[i + 1]!.member !== allMessages[i]!.member

  // Lookup parent message for replies
  const getParentMessage = (parentId: number | null) =>
    parentId ? allMessages.find(m => m.id === parentId) : undefined

  return (
    <div className={styles.chatPage}>
      <div className={styles.chatMain}>
        {/* Header */}
        <div className={styles.chatHeader}>
          <div className={styles.headerInfo}>
            <h2 className={styles.roomName}>{room.displayName}</h2>
            <span className={styles.participants}>
              <span className={styles.onlineDot} />
              {onlineCount} online · {room.participants.length} members
            </span>
          </div>
          <div className={styles.headerActions}>
            <Tooltip.Provider delayDuration={300}>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <motion.button
                    data-tour="search-btn"
                    className={`${styles.headerBtn} ${searchOpen ? styles.headerBtnActive : ''}`}
                    onClick={() => setSearchOpen(!searchOpen)}
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  >
                    <Search size={16} />
                  </motion.button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content className={styles.tooltip} sideOffset={6}>Search (Ctrl+F)<Tooltip.Arrow className={styles.tooltipArrow} /></Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <motion.button
                    data-tour="context-toggle"
                    className={`${styles.headerBtn} ${isPanelOpen ? styles.headerBtnActive : ''}`}
                    onClick={() => setIsPanelOpen(!isPanelOpen)}
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  >
                    {isPanelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
                  </motion.button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content className={styles.tooltip} sideOffset={6}>{isPanelOpen ? 'Close panel' : 'Context panel'}<Tooltip.Arrow className={styles.tooltipArrow} /></Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Provider>
          </div>
        </div>

        {/* Search panel */}
        <AnimatePresence>
          {searchOpen && <MessageSearch onClose={() => setSearchOpen(false)} />}
        </AnimatePresence>

        {/* Messages */}
        <div
          ref={messageAreaRef}
          className={styles.messageArea}
          onScroll={e => {
            const el = e.currentTarget
            setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 200)
          }}
        >
          {/* Pagination sentinel */}
          <HistoryLoader
            isLoading={historyState?.isLoading ?? false}
            hasMore={historyState?.hasMore ?? false}
            onLoadMore={handleLoadMore}
          />

          {allMessages.map((msg, i) => {
            const showDate = i === 0 || new Date(msg.timestamp).toDateString() !== new Date(allMessages[i - 1]!.timestamp).toDateString()
            const firstInGroup = isFirstInGroup(i)
            const lastInGroup = isLastInGroup(i)
            const isOwn = msg.member === 'alex'
            const parentMsg = getParentMessage(msg.parentId)

            return (
              <div key={msg.id}>
                {showDate && (
                  <div className={styles.dateSeparator}>
                    <span>{new Date(msg.timestamp).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                  </div>
                )}
                <motion.div
                  id={`msg-${msg.id}`}
                  className={`${styles.messageRow} ${isOwn ? styles.ownRow : ''} ${searchResults.length > 0 ? (searchResults.includes(msg.id) ? (searchResults[searchActiveIndex] === msg.id ? styles.searchActive : styles.searchMatch) : styles.searchDim) : ''}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15, delay: Math.min(i * 0.015, 0.3) }}
                  onMouseEnter={() => setHoveredMsg(msg.id)}
                  onMouseLeave={() => setHoveredMsg(null)}
                  style={{ marginTop: firstInGroup ? 'var(--space-md)' : '2px' }}
                >
                  {/* Avatar column */}
                  {!isOwn && (
                    <div className={styles.avatarCol}>
                      {firstInGroup ? (
                        <div className={styles.avatarWrapper}>
                          <div className={`${styles.avatar} ${msg.isAi ? styles.aiAvatarSmall : ''}`}>
                            {msg.isAi ? <Sparkles size={14} /> : (room.participants.find(p => p.username === msg.member)?.displayName?.[0] ?? '?')}
                          </div>
                          {(() => {
                            const participant = room.participants.find(p => p.username === msg.member)
                            return participant ? (
                              <div className={styles.presencePos}>
                                <PresenceDot isOnline={participant.isOnline} lastSeen={participant.lastSeen} size={7} />
                              </div>
                            ) : null
                          })()}
                        </div>
                      ) : (
                        <div className={styles.avatarSpacer} />
                      )}
                    </div>
                  )}

                  <div className={styles.messageCol}>
                    {/* Sender name */}
                    {firstInGroup && !isOwn && (
                      <div className={styles.senderRow}>
                        <span className={styles.messageSender}>
                          {msg.isAi && <span className={styles.aiBadge}><Sparkles size={9} /> AI</span>}
                          {msg.isAi ? 'Mathia' : room.participants.find(p => p.username === msg.member)?.displayName ?? msg.member}
                        </span>
                        <span className={styles.messageTime}>
                          {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}

                    {/* Reply reference */}
                    {parentMsg && <ReplyReference parentMessage={parentMsg} />}

                    {/* Message bubble */}
                    <div className={`${styles.message} ${msg.isAi ? styles.aiMessage : ''} ${isOwn ? styles.ownMessage : ''}`}>
                      {msg.thinking && (
                        <ThinkingBlock content={msg.thinking} durationMs={msg.thinkingDurationMs} />
                      )}
                      {msg.toolCalls?.map((tc, j) => (
                        <ToolCallDisplay key={j} toolName={tc.name} status={tc.status} result={tc.result} />
                      ))}
                      {msg.audioUrl ? (
                        <VoiceMessage audioUrl={msg.audioUrl} transcript={msg.voiceTranscript} />
                      ) : msg.content ? (
                        msg.isAi ? <MarkdownRenderer content={msg.content} /> : <div className={styles.messageText}>{msg.content}</div>
                      ) : null}
                      {msg.isStreaming && <span className={styles.streamingCursor} />}
                    </div>

                    {/* Actions toolbar */}
                    <div className={styles.actionsRow}>
                      <MessageActions content={msg.content} isAi={msg.isAi} visible={hoveredMsg === msg.id} />
                    </div>
                  </div>

                  {/* Own message time */}
                  {isOwn && lastInGroup && (
                    <span className={styles.ownTime}>
                      {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </motion.div>
              </div>
            )
          })}

          <TypingIndicator username="Mathia" />

          <AnimatePresence>
            {showScrollBtn && (
              <motion.button
                className={styles.scrollBtn}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => messageAreaRef.current?.scrollTo({ top: messageAreaRef.current.scrollHeight, behavior: 'smooth' })}
              >
                <ChevronDown size={18} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Input */}
        <div data-tour="chat-input">
          <ChatInput roomId={roomId} participants={room.participants} />
        </div>
      </div>

      {/* Context Panel */}
      <AnimatePresence>
        {isPanelOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 'var(--context-panel-width)', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden', flexShrink: 0 }}
          >
            <ContextPanel
              room={room}
              contacts={mockContacts.filter(c => c.roomId === room.id)}
              notes={mockNotes}
              actionReceipts={mockActionReceipts}
              onClose={() => setIsPanelOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
