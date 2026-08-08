import { motion } from 'framer-motion'
import styles from './MathiaAvatar.module.css'

interface Props {
  size?: number
  isActive?: boolean
}

export function MathiaAvatar({ size = 30, isActive = false }: Props) {
  return (
    <motion.div
      className={`${styles.container} ${isActive ? styles.active : ''}`}
      style={{ width: size, height: size }}
      animate={isActive ? { y: [0, -2, 0] } : {}}
      transition={isActive ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : {}}
    >
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={styles.svg}
      >
        {/* Head */}
        <rect x="6" y="10" width="28" height="22" rx="6" className={styles.head} />

        {/* Antenna */}
        <line x1="20" y1="10" x2="20" y2="4" strokeWidth="2" className={styles.antenna} />
        <motion.circle
          cx="20" cy="3" r="2.5"
          className={styles.antennaDot}
          animate={isActive ? { scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] } : {}}
          transition={isActive ? { duration: 1.5, repeat: Infinity } : {}}
        />

        {/* Eyes */}
        <motion.rect
          x="12" y="17" width="5" height="6" rx="2"
          className={styles.eye}
          animate={{ scaleY: [1, 1, 0.1, 1, 1] }}
          transition={{ duration: 4, repeat: Infinity, times: [0, 0.45, 0.5, 0.55, 1] }}
        />
        <motion.rect
          x="23" y="17" width="5" height="6" rx="2"
          className={styles.eye}
          animate={{ scaleY: [1, 1, 0.1, 1, 1] }}
          transition={{ duration: 4, repeat: Infinity, times: [0, 0.45, 0.5, 0.55, 1] }}
        />

        {/* Mouth — smile */}
        <path
          d="M15 27 Q20 31 25 27"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          className={styles.mouth}
        />

        {/* Ears / side details */}
        <rect x="2" y="18" width="4" height="8" rx="2" className={styles.ear} />
        <rect x="34" y="18" width="4" height="8" rx="2" className={styles.ear} />
      </svg>
    </motion.div>
  )
}
