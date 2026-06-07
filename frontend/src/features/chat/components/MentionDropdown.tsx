import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import type { Participant } from '@/types/chat'
import styles from './MentionDropdown.module.css'

interface Props {
  participants: Participant[]
  selectedIndex: number
  onSelect: (participant: Participant) => void
}

export function MentionDropdown({ participants, selectedIndex, onSelect }: Props) {
  if (participants.length === 0) return null

  return (
    <motion.div
      className={styles.dropdown}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.12 }}
    >
      {participants.map((p, i) => (
        <button
          key={p.username}
          className={`${styles.item} ${i === selectedIndex ? styles.selected : ''}`}
          onClick={() => onSelect(p)}
          onMouseDown={e => e.preventDefault()}
        >
          <div className={`${styles.avatar} ${p.username === 'mathia' ? styles.aiAvatar : ''}`}>
            {p.username === 'mathia' ? <Sparkles size={12} /> : p.displayName[0]}
          </div>
          <div className={styles.info}>
            <span className={styles.name}>{p.displayName}</span>
            <span className={styles.handle}>@{p.username}</span>
          </div>
        </button>
      ))}
    </motion.div>
  )
}
