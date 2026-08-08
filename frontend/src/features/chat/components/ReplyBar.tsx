import { motion } from 'framer-motion'
import { X, CornerDownLeft } from 'lucide-react'
import type { Message } from '@/types/chat'
import styles from './ReplyBar.module.css'

interface Props {
  message: Message
  onDismiss: () => void
}

export function ReplyBar({ message, onDismiss }: Props) {
  const snippet = message.content.length > 60
    ? message.content.slice(0, 60) + '...'
    : message.content

  return (
    <motion.div
      className={styles.bar}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <CornerDownLeft size={14} className={styles.icon} />
      <div className={styles.content}>
        <span className={styles.author}>{message.isAi ? 'Mathia' : message.member}</span>
        <span className={styles.snippet}>{snippet || '🎤 Voice message'}</span>
      </div>
      <button className={styles.dismiss} onClick={onDismiss}>
        <X size={14} />
      </button>
    </motion.div>
  )
}
