import { AnimatePresence, motion } from 'framer-motion'
import { MathiaAvatar } from '@/components/ui/MathiaAvatar'
import styles from './TypingIndicator.module.css'

interface Props {
  isThinking?: boolean
}

export function TypingIndicator({ isThinking }: Props) {
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
    </AnimatePresence>
  )
}
