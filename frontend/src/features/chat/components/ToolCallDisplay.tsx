import { motion } from 'framer-motion'
import { Terminal, Code2, Ban, Loader2 } from 'lucide-react'
import styles from './ToolCallDisplay.module.css'

interface Props {
  toolName: string
  status: 'calling' | 'result' | 'cancelled'
  result?: string
}

export function ToolCallDisplay({ toolName, status, result }: Props) {
  return (
    <div className={`${styles.block} ${styles[status]}`}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          {status === 'calling' && <Loader2 size={14} className={styles.spinner} />}
          {status === 'result' && <Code2 size={14} />}
          {status === 'cancelled' && <Ban size={14} />}
          <Terminal size={13} />
          <span className={styles.toolName}>{toolName}</span>
        </div>
        <span className={styles.statusLabel}>
          {status === 'calling' && 'Running...'}
          {status === 'result' && 'Completed'}
          {status === 'cancelled' && 'Cancelled'}
        </span>
      </div>
      {result && status === 'result' && (
        <motion.pre
          className={styles.result}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {result}
        </motion.pre>
      )}
    </div>
  )
}
