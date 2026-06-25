import { AnimatePresence, motion } from 'framer-motion'
import { MathiaAvatar } from '@/components/ui/MathiaAvatar'
import styles from './TypingIndicator.module.css'

interface Props {
  isThinking?: boolean
  /** Display names of human participants currently typing. */
  typingUsers?: string[]
}

function peerLabel(names: string[]): string {
  if (names.length === 1) return `${names[0]} is typing`
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing`
  return `${names[0]} and ${names.length - 1} others are typing`
}

export function TypingIndicator({ isThinking, typingUsers = [] }: Props) {
  const showPeers = !isThinking && typingUsers.length > 0
  return (
    <AnimatePresence initial={false}>
      {isThinking && (
        <motion.div
          key="thinking"
          className={styles.container}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -2 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <MathiaAvatar size={28} isActive />
          <div className={styles.bubble}>
            <div className={styles.dots}>
              <span className={styles.dot} />
              <span className={styles.dot} />
              <span className={styles.dot} />
            </div>
          </div>
          <span className={styles.label}>thinking</span>
        </motion.div>
      )}
      {showPeers && (
        <motion.div
          key="peers"
          className={styles.container}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -2 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <div className={styles.bubble}>
            <div className={styles.dots}>
              <span className={styles.dot} />
              <span className={styles.dot} />
              <span className={styles.dot} />
            </div>
          </div>
          <span className={styles.label}>{peerLabel(typingUsers)}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
