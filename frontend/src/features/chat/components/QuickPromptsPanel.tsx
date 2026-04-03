import { motion } from 'framer-motion'
import { QUICK_PROMPTS, type QuickPromptAction } from '@/utils/quickPrompts'
import styles from './QuickPromptsPanel.module.css'

interface Props {
  onSelect: (action: QuickPromptAction) => void
  onClose: () => void
}

export function QuickPromptsPanel({ onSelect, onClose }: Props) {
  return (
    <motion.div
      className={styles.panel}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.15 }}
    >
      <div className={styles.header}>
        <span className={styles.title}>Quick Actions</span>
        <button className={styles.close} onClick={onClose}>✕</button>
      </div>
      <div className={styles.grid}>
        {QUICK_PROMPTS.map(action => {
          const Icon = action.icon
          return (
            <button
              key={action.id}
              className={styles.action}
              onClick={() => onSelect(action)}
            >
              <Icon size={18} />
              <span>{action.label}</span>
            </button>
          )
        })}
      </div>
    </motion.div>
  )
}
