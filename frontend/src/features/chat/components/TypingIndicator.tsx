import { MathiaAvatar } from '@/components/ui/MathiaAvatar'
import styles from './TypingIndicator.module.css'

interface Props {
  isThinking?: boolean
}

export function TypingIndicator({ isThinking }: Props) {
  if (!isThinking) return null
  
  return (
    <div className={styles.container}>
      <MathiaAvatar size={28} isActive />
      <div className={styles.bubble}>
        <div className={styles.dots}>
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
        </div>
      </div>
      <span className={styles.label}>thinking</span>
    </div>
  )
}
