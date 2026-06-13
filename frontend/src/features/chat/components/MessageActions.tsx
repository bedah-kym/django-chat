import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as Tooltip from '@radix-ui/react-tooltip'
import { Copy, Check, ThumbsUp, ThumbsDown, RefreshCw, Pin, CornerUpLeft, Volume2, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { pinMessage, submitMessageFeedback } from '@/api/chat'
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis'
import styles from './MessageActions.module.css'

interface Props {
  content: string
  isAi: boolean
  visible: boolean
  roomId?: number
  messageId?: number
  onReply?: () => void
  onRegenerate?: () => void
  onEdit?: () => void
  onDelete?: () => void
}

export function MessageActions({ content, isAi, visible, roomId, messageId, onReply, onRegenerate, onEdit, onDelete }: Props) {
  const [copied, setCopied] = useState(false)
  const [rated, setRated] = useState<'up' | 'down' | null>(null)
  const [feedbackLocked, setFeedbackLocked] = useState(false)
  const [pinning, setPinning] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const { isSupported: ttsSupported, speak } = useSpeechSynthesis()

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePin = async () => {
    if (!roomId || !messageId || pinning) return
    setPinning(true)
    try {
      await pinMessage(roomId, messageId)
      toast.success('Pinned to notes')
    } catch {
      toast.error('Could not pin message')
    } finally {
      setPinning(false)
    }
  }

  const handleRetry = () => {
    if (!onRegenerate || retrying) return
    setRetrying(true)
    try {
      onRegenerate()
      toast('Regenerating response…')
    } finally {
      setTimeout(() => setRetrying(false), 800)
    }
  }

  const handleFeedback = async (rating: 'up' | 'down') => {
    if (feedbackLocked || !roomId || !messageId) return
    const newRating = rated === rating ? null : rating
    const prev = rated
    setRated(newRating)
    setFeedbackLocked(true)
    try {
      await submitMessageFeedback(roomId, messageId, newRating)
      if (newRating) toast.success(newRating === 'up' ? 'Rated helpful' : 'Feedback noted')
    } catch {
      setRated(prev)
    } finally {
      setFeedbackLocked(false)
    }
  }

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className={`${styles.actions} ${visible ? styles.visible : ''}`}>
        {/* Reply */}
        {onReply ? (
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button className={styles.btn} onClick={onReply} aria-label="Reply">
                <CornerUpLeft size={14} />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className={styles.tooltip} sideOffset={4}>Reply</Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        ) : null}

        {/* Copy */}
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button className={styles.btn} onClick={handleCopy}>
              <AnimatePresence mode="wait">
                {copied ? (
                  <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                    <Check size={14} className={styles.checkIcon} />
                  </motion.div>
                ) : (
                  <motion.div key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                    <Copy size={14} />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content className={styles.tooltip} sideOffset={4}>
              {copied ? 'Copied!' : 'Copy'}
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>

        {/* Pin */}
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button className={styles.btn} onClick={handlePin} disabled={pinning || !roomId || !messageId}>
              <Pin size={14} />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content className={styles.tooltip} sideOffset={4}>Pin to Notes</Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>

        {/* Edit (own messages) */}
        {!isAi && onEdit ? (
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button className={styles.btn} onClick={onEdit} aria-label="Edit message">
                <Pencil size={14} />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className={styles.tooltip} sideOffset={4}>Edit</Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        ) : null}

        {/* Delete (own messages) */}
        {!isAi && onDelete ? (
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button className={styles.btn} onClick={onDelete} aria-label="Delete message">
                <Trash2 size={14} />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className={styles.tooltip} sideOffset={4}>Delete</Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        ) : null}

        {/* AI-only actions */}
        {isAi && (
          <>
            <div className={styles.divider} />

            {ttsSupported && content ? (
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <button className={styles.btn} onClick={() => { speak(content) }} aria-label="Read aloud">
                    <Volume2 size={14} />
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content className={styles.tooltip} sideOffset={4}>Read aloud</Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            ) : null}

            {/* Thumbs up */}
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  className={`${styles.btn} ${rated === 'up' ? styles.ratedUp : ''}`}
                  onClick={() => handleFeedback('up')}
                  disabled={feedbackLocked}
                  aria-label="Rate helpful"
                >
                  <ThumbsUp size={14} />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className={styles.tooltip} sideOffset={4}>Good response</Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>

            {/* Thumbs down */}
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  className={`${styles.btn} ${rated === 'down' ? styles.ratedDown : ''}`}
                  onClick={() => handleFeedback('down')}
                  disabled={feedbackLocked}
                  aria-label="Rate unhelpful"
                >
                  <ThumbsDown size={14} />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className={styles.tooltip} sideOffset={4}>Poor response</Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>

            {/* Regenerate */}
            {onRegenerate ? (
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <button className={styles.btn} onClick={handleRetry} disabled={retrying}>
                    <RefreshCw size={14} />
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content className={styles.tooltip} sideOffset={4}>Regenerate</Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            ) : null}
          </>
        )}
      </div>
    </Tooltip.Provider>
  )
}
