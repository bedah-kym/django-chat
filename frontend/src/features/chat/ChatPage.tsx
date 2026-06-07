import { useLocation, useParams } from 'react-router-dom'
import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as Tooltip from '@radix-ui/react-tooltip'
import { Search, PanelRightOpen, PanelRightClose, ChevronDown } from 'lucide-react'
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
import { MathiaAvatar } from '@/components/ui/MathiaAvatar'
import { QuotaBar } from './components/QuotaBar'
import { domainConfigs, getDomainFromPathname } from '@/domains'
import { formatDate, formatTime } from '@/utils/format'
import styles from './ChatPage.module.css'

export function ChatPage() {
  const { roomId: roomIdParam } = useParams<{ roomId: string }>()
  const location = useLocation()
  const roomId = Number(roomIdParam)
  const activeDomainId = getDomainFromPathname(location.pathname)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [hoveredMsg, setHoveredMsg] = useState<number | null>(null)
  const messageAreaRef = useRef<HTMLDivElement>(null)
  const prevScrollHeightRef = useRef(0)

  const rooms = useChatStore((s) => s.rooms)
  const messages = useChatStore((s) => s.messagesByRoom[roomId] ?? [])
  const setActiveRoom = useChatStore((s) => s.setActiveRoom)
  const historyState = useChatStore((s) => s.historyState[roomId])
  const searchOpen = useChatStore((s) => s.searchOpen)
  const setSearchOpen = useChatStore((s) => s.setSearchOpen)
  const searchResults = useChatStore((s) => s.searchResults)
  const searchActiveIndex = useChatStore((s) => s.searchActiveIndex)
  const loadOlderMessages = useChatStore((s) => s.loadOlderMessages)

  const room = rooms.find((candidate) => candidate.id === roomId)

  useEffect(() => {
    if (roomId) setActiveRoom(roomId)
  }, [roomId, setActiveRoom])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault()
        setSearchOpen(!searchOpen)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [searchOpen, setSearchOpen])

  useLayoutEffect(() => {
    const element = messageAreaRef.current
    if (!element) return
    if (prevScrollHeightRef.current > 0 && element.scrollHeight > prevScrollHeightRef.current) {
      element.scrollTop += element.scrollHeight - prevScrollHeightRef.current
    }
    prevScrollHeightRef.current = element.scrollHeight
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

  if (activeDomainId && room.domain !== activeDomainId) {
    return <div className={styles.empty}>This room belongs to a different workspace</div>
  }

  const onlineCount = room.participants.filter((participant) => participant.isOnline).length
  const allMessages = messages
  const workspaceLabel = domainConfigs[room.domain].label

  const isFirstInGroup = (index: number) =>
    index === 0 || allMessages[index - 1]!.member !== allMessages[index]!.member

  const isLastInGroup = (index: number) =>
    index === allMessages.length - 1 || allMessages[index + 1]!.member !== allMessages[index]!.member

  const getParentMessage = (parentId: number | null) =>
    parentId ? allMessages.find((message) => message.id === parentId) : undefined

  return (
    <section className={styles.chatPage} aria-label={`${room.displayName} chat workspace`}>
      <div className={styles.chatMain}>
        <header className={styles.chatHeader}>
          <div className={styles.headerInfo}>
            <div className={styles.headerEyebrow}>{workspaceLabel} room</div>
            <h1 className={styles.roomName}>{room.displayName}</h1>
            <span className={styles.participants}>
              <span className={styles.onlineDot} />
              {onlineCount} online | {room.participants.length} members
            </span>
          </div>
          <div className={styles.headerActions}>
            <Tooltip.Provider delayDuration={250}>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <button
                    className={`${styles.headerBtn} ${searchOpen ? styles.headerBtnActive : ''}`}
                    onClick={() => setSearchOpen(!searchOpen)}
                    aria-label="Search messages"
                  >
                    <Search size={16} />
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content className={styles.tooltip} sideOffset={6}>
                    Search (Ctrl+F)
                    <Tooltip.Arrow className={styles.tooltipArrow} />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <button
                    className={`${styles.headerBtn} ${isPanelOpen ? styles.headerBtnActive : ''}`}
                    onClick={() => setIsPanelOpen(!isPanelOpen)}
                    aria-label="Toggle context panel"
                  >
                    {isPanelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content className={styles.tooltip} sideOffset={6}>
                    {isPanelOpen ? 'Close context panel' : 'Open context panel'}
                    <Tooltip.Arrow className={styles.tooltipArrow} />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Provider>
          </div>
        </header>

        <AnimatePresence>
          {searchOpen ? <MessageSearch onClose={() => setSearchOpen(false)} /> : null}
        </AnimatePresence>

        <QuotaBar remaining={3} total={5} />

        <div
          ref={messageAreaRef}
          className={styles.messageArea}
          onScroll={(event) => {
            const element = event.currentTarget
            setShowScrollBtn(element.scrollHeight - element.scrollTop - element.clientHeight > 200)
          }}
        >
          <HistoryLoader
            isLoading={historyState?.isLoading ?? false}
            hasMore={historyState?.hasMore ?? false}
            onLoadMore={handleLoadMore}
          />

          {allMessages.map((msg, index) => {
            const showDate =
              index === 0 ||
              new Date(msg.timestamp).toDateString() !== new Date(allMessages[index - 1]!.timestamp).toDateString()
            const firstInGroup = isFirstInGroup(index)
            const lastInGroup = isLastInGroup(index)
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
                  className={`${styles.messageRow} ${isOwn ? styles.ownRow : ''} ${
                    searchResults.length > 0
                      ? searchResults.includes(msg.id)
                        ? searchResults[searchActiveIndex] === msg.id
                          ? styles.searchActive
                          : styles.searchMatch
                        : styles.searchDim
                      : ''
                  }`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15, delay: Math.min(index * 0.015, 0.3) }}
                  onMouseEnter={() => setHoveredMsg(msg.id)}
                  onMouseLeave={() => setHoveredMsg(null)}
                  style={{ marginTop: firstInGroup ? 'var(--space-md)' : '2px' }}
                >
                  {!isOwn ? (
                    <div className={styles.avatarCol}>
                      {firstInGroup ? (
                        <div className={styles.avatarWrapper}>
                          <div className={`${styles.avatar} ${msg.isAi ? styles.aiAvatarSmall : ''}`}>
                            {msg.isAi
                              ? <MathiaAvatar size={30} isActive={!!msg.isStreaming} />
                              : room.participants.find((participant) => participant.username === msg.member)?.displayName?.[0] ?? '?'}
                          </div>
                          {(() => {
                            const participant = room.participants.find((candidate) => candidate.username === msg.member)
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
                  ) : null}

                  <div className={styles.messageCol}>
                    {firstInGroup && !isOwn ? (
                      <div className={styles.senderRow}>
                        <span className={styles.messageSender}>
                          {msg.isAi ? 'Mathia' : room.participants.find((participant) => participant.username === msg.member)?.displayName ?? msg.member}
                          {msg.isAi ? <span className={styles.aiLabel}>AI</span> : null}
                        </span>
                      </div>
                    ) : null}

                    {firstInGroup && !isOwn ? (
                      <span className={styles.marginTime}>{formatTime(msg.timestamp)}</span>
                    ) : null}

                    {parentMsg ? <ReplyReference parentMessage={parentMsg} /> : null}

                    <div className={`${styles.message} ${msg.isAi ? styles.aiMessage : ''} ${isOwn ? styles.ownMessage : ''}`}>
                      {msg.thinking ? <ThinkingBlock content={msg.thinking} durationMs={msg.thinkingDurationMs} /> : null}
                      {msg.toolCalls?.map((toolCall, toolIndex) => (
                        <ToolCallDisplay key={toolIndex} toolName={toolCall.name} status={toolCall.status} result={toolCall.result} />
                      ))}
                      {msg.audioUrl ? (
                        <VoiceMessage audioUrl={msg.audioUrl} transcript={msg.voiceTranscript} />
                      ) : msg.content ? (
                        msg.isAi ? <MarkdownRenderer content={msg.content} /> : <div className={styles.messageText}>{msg.content}</div>
                      ) : null}
                      {msg.isStreaming ? <span className={styles.streamingCursor} /> : null}
                    </div>

                    <div className={styles.actionsRow}>
                      <MessageActions content={msg.content} isAi={msg.isAi} visible={hoveredMsg === msg.id} />
                    </div>
                  </div>

                  {isOwn && lastInGroup ? <span className={styles.ownTime}>{formatTime(msg.timestamp)}</span> : null}
                </motion.div>
              </div>
            )
          })}

          <div className={styles.typingRow}>
            <TypingIndicator username="Mathia" />
          </div>

          <AnimatePresence>
            {showScrollBtn ? (
              <motion.button
                className={styles.scrollBtn}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => messageAreaRef.current?.scrollTo({ top: messageAreaRef.current.scrollHeight, behavior: 'smooth' })}
              >
                <ChevronDown size={18} />
              </motion.button>
            ) : null}
          </AnimatePresence>
        </div>

        <div data-tour="chat-input">
          <ChatInput roomId={roomId} participants={room.participants} />
        </div>
      </div>

      <AnimatePresence>
        {isPanelOpen ? (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 'var(--context-panel-width)', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className={styles.contextWrap}
          >
            <ContextPanel
              room={room}
              contacts={mockContacts.filter((contact) => contact.roomId === room.id)}
              notes={mockNotes}
              actionReceipts={mockActionReceipts}
              onClose={() => setIsPanelOpen(false)}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}
