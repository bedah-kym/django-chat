import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronRight, Sparkles } from 'lucide-react'
import { useChatSocket } from '@/hooks/useChatSocket'
import { useAuthStore } from '@/stores/authStore'
import { ChatInput } from '@/features/chat/components/ChatInput'
import { MarkdownRenderer } from '@/features/chat/components/MarkdownRenderer'
import { MathiaAvatar } from '@/components/ui/MathiaAvatar'
import { getTripChatroom } from '@/api/travel'
import type { Participant } from '@/types/chat'
import styles from './TripChatPanel.module.css'

/** Live message thread — only mounted once we have a room id so the socket
 *  hook never connects to an invalid room. */
function TripChatThread({ roomId, participants }: { roomId: number; participants: Participant[] }) {
  const messages = useChatSocket(roomId)
  const username = useAuthStore((s) => s.username) || ''
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  return (
    <>
      <div className={styles.thread} ref={scrollRef}>
        {messages.length === 0 ? (
          <div className={styles.empty}>
            <MathiaAvatar size={40} />
            <p className={styles.emptyTitle}>Plan this trip with Mathia</p>
            <p className={styles.emptyBody}>
              Ask her to find flights, hotels, or things to do — she can add them
              straight to your itinerary, or remove ones you don't want.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = !msg.isAi && msg.member === username
            const initial =
              participants.find((p) => p.username === msg.member)?.displayName?.[0]?.toUpperCase() ??
              msg.member?.[0]?.toUpperCase() ?? '?'
            return (
              <div key={msg.id} className={`${styles.msgRow} ${isOwn ? styles.own : ''}`}>
                {!isOwn ? (
                  <div className={styles.msgAvatar}>
                    {msg.isAi ? <MathiaAvatar size={26} /> : <div className={styles.userAv}>{initial}</div>}
                  </div>
                ) : null}
                <div className={`${styles.bubble} ${isOwn ? styles.bubbleOwn : ''} ${msg.isAi ? styles.bubbleAi : ''}`}>
                  {msg.isAi ? (
                    <MarkdownRenderer content={msg.content} />
                  ) : (
                    <div className={styles.bubbleText}>{msg.content}</div>
                  )}
                  {msg.isStreaming ? <span className={styles.cursor} /> : null}
                </div>
              </div>
            )
          })
        )}
      </div>
      <ChatInput roomId={roomId} participants={participants} />
    </>
  )
}

interface TripChatPanelProps {
  tripId: number
  collapsed: boolean
  onToggle: () => void
}

export function TripChatPanel({ tripId, collapsed, onToggle }: TripChatPanelProps) {
  const [roomId, setRoomId] = useState<number | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  // Resolve (lazily creating) the trip's chatroom once the panel is expanded.
  useEffect(() => {
    if (collapsed || roomId !== null) return
    let cancelled = false
    setState('loading')
    getTripChatroom(tripId)
      .then((res) => {
        if (cancelled) return
        setRoomId(res.chatroom_id)
        setParticipants(
          res.participants.map((p) => ({
            username: p.username,
            displayName: p.displayName,
            avatarUrl: p.avatarUrl,
            isOnline: p.isOnline,
            lastSeen: p.lastSeen ?? undefined,
          })),
        )
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })
    return () => { cancelled = true }
  }, [tripId, collapsed, roomId])

  if (collapsed) {
    return (
      <button type="button" className={styles.rail} onClick={onToggle} aria-label="Open Mathia trip chat">
        <MathiaAvatar size={30} />
        <span className={styles.railLabel}>Ask Mathia</span>
      </button>
    )
  }

  return (
    <motion.aside
      className={styles.panel}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      aria-label="Mathia trip chat"
    >
      <header className={styles.header}>
        <div className={styles.headerId}>
          <MathiaAvatar size={28} />
          <div>
            <div className={styles.headerName}>Mathia <Sparkles size={12} /></div>
            <div className={styles.headerSub}>Trip assistant</div>
          </div>
        </div>
        <button type="button" className={styles.collapseBtn} onClick={onToggle} aria-label="Collapse chat">
          <ChevronRight size={18} />
        </button>
      </header>

      {state === 'loading' ? (
        <div className={styles.status}>Connecting…</div>
      ) : state === 'error' ? (
        <div className={styles.status}>Couldn't load the trip chat. Try reopening it.</div>
      ) : roomId !== null ? (
        <TripChatThread roomId={roomId} participants={participants} />
      ) : null}
    </motion.aside>
  )
}
