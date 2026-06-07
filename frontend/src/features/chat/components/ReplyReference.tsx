import { CornerDownLeft } from 'lucide-react'
import type { Message } from '@/types/chat'
import styles from './ReplyReference.module.css'

interface Props {
  parentMessage: Message
}

export function ReplyReference({ parentMessage }: Props) {
  const snippet = parentMessage.content.length > 50
    ? parentMessage.content.slice(0, 50) + '...'
    : parentMessage.content

  return (
    <div className={styles.ref}>
      <CornerDownLeft size={11} />
      <span className={styles.author}>{parentMessage.isAi ? 'Mathia' : parentMessage.member}</span>
      <span className={styles.text}>{snippet || '🎤 Voice message'}</span>
    </div>
  )
}
