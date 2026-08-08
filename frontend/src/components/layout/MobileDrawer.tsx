import { type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import styles from './MobileDrawer.module.css'

interface Props {
  open: boolean
  onClose: () => void
  children: ReactNode
}

export function MobileDrawer({ open, onClose, children }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className={styles.drawer}
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
