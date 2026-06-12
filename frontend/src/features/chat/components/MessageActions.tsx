import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as Tooltip from '@radix-ui/react-tooltip'
import { Copy, Check, ThumbsUp, ThumbsDown, RefreshCw, Pin } from 'lucide-react'
import { toast } from 'sonner'
import { pinMessage, retryAiMessage } from '@/api/chat'
import styles from './MessageActions.module.css'

interface Props {
  content: string
  isAi: boolean
  visible: boolean
  roomId?: number
  messageId?: number
}

export function MessageActions({ content, isAi, visible, roomId, messageId }: Props) {
  const [copied, setCopied] = useState(false)
  const [rated, setRated] = useState<'up' | 'down' | null>(null)
  const [pinning, setPinning] = useState(false)
  const [retrying, setRetrying] = useState(false)

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

  const handleRetry = async () => {
    if (!roomId || !messageId || retrying) return
    setRetrying(true)
    try {
      await retryAiMessage(roomId, messageId)
      toast('Regenerating response…')
    } catch {
      toast.error('Could not regenerate')
    } finally {
      setRetrying(false)
    }
  }

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className={`${styles.actions} ${visible ? styles.visible : ''}`}>
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

        {/* AI-only actions */}
        {isAi && (
          <>
            <div className={styles.divider} />

            {/* Thumbs up */}
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  className={`${styles.btn} ${rated === 'up' ? styles.ratedUp : ''}`}
                  onClick={() => { setRated(rated === 'up' ? null : 'up'); toast.success('Thanks for the feedback') }}
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
                  onClick={() => { setRated(rated === 'down' ? null : 'down'); toast('Feedback noted') }}
                >
                  <ThumbsDown size={14} />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className={styles.tooltip} sideOffset={4}>Poor response</Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>

            {/* Retry */}
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button className={styles.btn} onClick={handleRetry} disabled={retrying || !roomId || !messageId}>
                  <RefreshCw size={14} />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className={styles.tooltip} sideOffset={4}>Regenerate</Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </>
        )}
      </div>
    </Tooltip.Provider>
  )
}
