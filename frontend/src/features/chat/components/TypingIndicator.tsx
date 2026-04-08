import { MathiaAvatar } from '@/components/ui/MathiaAvatar'
import styles from './TypingIndicator.module.css'

interface Props {
  username?: string
}

export function TypingIndicator({ username }: Props) {
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
      {username && <span className={styles.label}>{username} is typing</span>}
    </div>
  )
}
