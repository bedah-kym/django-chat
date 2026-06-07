import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, ChevronDown } from 'lucide-react'
import styles from './ThinkingBlock.module.css'

interface Props {
  content: string
  durationMs?: number
  isActive?: boolean
}

export function ThinkingBlock({ content, durationMs, isActive }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className={`${styles.block} ${isActive ? styles.active : ''}`}>
      <button className={styles.header} onClick={() => setIsOpen(!isOpen)}>
        <div className={styles.headerLeft}>
          <Brain size={14} className={isActive ? styles.pulsingIcon : ''} />
          <span className={styles.label}>
            {isActive ? 'Thinking...' : 'Thought process'}
          </span>
          {durationMs && !isActive && (
            <span className={styles.duration}>{(durationMs / 1000).toFixed(1)}s</span>
          )}
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown size={14} className={styles.chevron} />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className={styles.content}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.04, 0.62, 0.23, 0.98] }}
          >
            <div className={styles.contentInner}>
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
